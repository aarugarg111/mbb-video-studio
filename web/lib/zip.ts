/* Three videos as one download.
 *
 * A clip is now cut three ways - a Reel, a square feed post and a widescreen
 * one - and whoever is posting it wants all three, not three trips through
 * the studio. Three separate downloads is three "save as" dialogs and three
 * files loose in a Downloads folder with nothing saying they belong
 * together; one archive is one click and one folder.
 *
 * Written out here rather than pulled in, because this is the whole of what
 * a zip needs to be for this job and a library for it would be a dependency
 * on the render path - the one place in the studio where a surprise costs a
 * whole minute of somebody's render.
 *
 * STORED, not deflated. An mp4 is already compressed; running it through
 * deflate would spend the time and save nothing. "Stored" is a zip feature
 * as old as the format, so every unarchiver on every machine opens it.
 */

/* The table is built once rather than written out: it is 256 entries of
 * nothing anybody could read, and the polynomial below is the actual fact. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export type ZipEntry = { name: string; bytes: Uint8Array };

/* A date in the shape MS-DOS used in 1980, which is the shape a zip still
 * stores. A fixed date rather than "now": two archives of the same three
 * videos should be the same bytes, the way everything else in this studio is.
 * Unarchivers show it as the files' date, so it is the day this was written
 * rather than something that reads as an error. */
const DOS_TIME = 0;                       /* 00:00:00 */
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;   /* 1 January 2026 */

function putU16(view: DataView, at: number, value: number) { view.setUint16(at, value, true); }
function putU32(view: DataView, at: number, value: number) { view.setUint32(at, value, true); }

/* The archive, as bytes.
 *
 * Three sections, which is all a zip is: each file behind its own local
 * header, then a directory listing those files, then a record saying where
 * the directory starts. The offsets have to agree or the archive opens as
 * empty, which is why they are counted rather than guessed.
 */
export function zip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const prepared = entries.map(e => {
    const name = encoder.encode(e.name);
    return { name, bytes: e.bytes, crc: crc32(e.bytes) };
  });

  const LOCAL = 30, CENTRAL = 46, END = 22;
  const localSize = prepared.reduce((n, e) => n + LOCAL + e.name.length + e.bytes.length, 0);
  const centralSize = prepared.reduce((n, e) => n + CENTRAL + e.name.length, 0);

  const out = new Uint8Array(localSize + centralSize + END);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];
  let at = 0;

  for (const e of prepared) {
    offsets.push(at);
    putU32(view, at, 0x04034B50);       /* local file header */
    putU16(view, at + 4, 20);           /* version needed: 2.0 */
    putU16(view, at + 6, 0);            /* no flags - the names are ASCII */
    putU16(view, at + 8, 0);            /* method 0: stored */
    putU16(view, at + 10, DOS_TIME);
    putU16(view, at + 12, DOS_DATE);
    putU32(view, at + 14, e.crc);
    putU32(view, at + 18, e.bytes.length);   /* compressed   */
    putU32(view, at + 22, e.bytes.length);   /* uncompressed */
    putU16(view, at + 26, e.name.length);
    putU16(view, at + 28, 0);           /* no extra field */
    out.set(e.name, at + LOCAL);
    out.set(e.bytes, at + LOCAL + e.name.length);
    at += LOCAL + e.name.length + e.bytes.length;
  }

  const directoryAt = at;
  prepared.forEach((e, i) => {
    putU32(view, at, 0x02014B50);       /* central directory header */
    putU16(view, at + 4, 20);           /* made by */
    putU16(view, at + 6, 20);           /* version needed */
    putU16(view, at + 8, 0);
    putU16(view, at + 10, 0);           /* stored */
    putU16(view, at + 12, DOS_TIME);
    putU16(view, at + 14, DOS_DATE);
    putU32(view, at + 16, e.crc);
    putU32(view, at + 20, e.bytes.length);
    putU32(view, at + 24, e.bytes.length);
    putU16(view, at + 28, e.name.length);
    putU16(view, at + 30, 0);           /* extra   */
    putU16(view, at + 32, 0);           /* comment */
    putU16(view, at + 34, 0);           /* disk    */
    putU16(view, at + 36, 0);           /* internal attributes */
    putU32(view, at + 38, 0);           /* external attributes */
    putU32(view, at + 42, offsets[i]);
    out.set(e.name, at + CENTRAL);
    at += CENTRAL + e.name.length;
  });

  putU32(view, at, 0x06054B50);         /* end of central directory */
  putU16(view, at + 4, 0);              /* this disk  */
  putU16(view, at + 6, 0);              /* first disk */
  putU16(view, at + 8, prepared.length);
  putU16(view, at + 10, prepared.length);
  putU32(view, at + 12, centralSize);
  putU32(view, at + 16, directoryAt);
  putU16(view, at + 20, 0);             /* no archive comment */

  return new Blob([out], { type: 'application/zip' });
}

/* The same, taking the blobs a render hands back. */
export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries = await Promise.all(
    files.map(async f => ({ name: f.name, bytes: new Uint8Array(await f.blob.arrayBuffer()) }))
  );
  return zip(entries);
}
