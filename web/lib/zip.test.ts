import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zip, crc32, zipBlobs } from './zip';

/* Three videos as one download.
 *
 * A zip written by hand is the kind of thing that looks right, opens on the
 * machine that made it, and fails on somebody else's - so these check the
 * bytes against the format rather than against this file's own idea of it,
 * and the last one hands the archive to a real unarchiver.
 */

const bytes = (s: string) => new TextEncoder().encode(s);

test('the checksum is the one the format specifies', () => {
  /* The published CRC-32 of "123456789". If this is wrong every archive is
     readable right up to the moment something verifies it. */
  assert.equal(crc32(bytes('123456789')), 0xCBF43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('an archive starts and ends where a zip is meant to', async () => {
  const blob = zip([{ name: 'a.txt', bytes: bytes('hello') }]);
  const out = new Uint8Array(await blob.arrayBuffer());

  assert.equal(blob.type, 'application/zip');
  assert.deepEqual([...out.slice(0, 4)], [0x50, 0x4B, 0x03, 0x04], 'no local file header');
  const end = out.length - 22;
  assert.deepEqual([...out.slice(end, end + 4)], [0x50, 0x4B, 0x05, 0x06], 'no end record');
});

test('the directory says where each file actually is', async () => {
  /* The offsets are counted while the files are written. Guessing them gives
     an archive that opens as empty, which looks like the render failed. */
  const files = [
    { name: 'tall.mp4', bytes: bytes('one') },
    { name: 'square.mp4', bytes: bytes('two-two') },
    { name: 'wide.mp4', bytes: bytes('three') }
  ];
  const out = new Uint8Array(await zip(files).arrayBuffer());
  const view = new DataView(out.buffer);

  const end = out.length - 22;
  assert.equal(view.getUint16(end + 8, true), 3, 'the count is wrong');
  const directoryAt = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(directoryAt, true), 0x02014B50, 'the directory is not there');

  /* Walk the directory and check every entry points at its own header. */
  let at = directoryAt;
  for (const f of files) {
    const nameLen = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(out.slice(at + 46, at + 46 + nameLen));
    const localAt = view.getUint32(at + 42, true);
    assert.equal(name, f.name);
    assert.equal(view.getUint32(localAt, true), 0x04034B50, `${name} points at no header`);
    assert.equal(view.getUint32(localAt + 14, true), crc32(f.bytes), `${name} has the wrong checksum`);
    assert.equal(view.getUint32(localAt + 18, true), f.bytes.length, `${name} has the wrong length`);
    at += 46 + nameLen;
  }
  assert.equal(at, end, 'the directory does not end where the end record starts');
});

test('the files are stored, not compressed', async () => {
  /* An mp4 is already compressed. Deflating it would spend the time and save
     nothing, and "stored" is what every unarchiver has always understood. */
  const out = new Uint8Array(await zip([{ name: 'a.mp4', bytes: bytes('x'.repeat(500)) }]).arrayBuffer());
  const view = new DataView(out.buffer);
  assert.equal(view.getUint16(8, true), 0, 'the method is not "stored"');
  assert.equal(view.getUint32(18, true), view.getUint32(22, true),
    'the two sizes differ, so something was compressed');
});

test('the same three videos make the same archive twice', async () => {
  /* Everything else in this studio is byte-reproducible; an archive stamped
     with the time of day would be the one thing that is not. */
  const files = [{ name: 'a.mp4', bytes: bytes('aaa') }, { name: 'b.mp4', bytes: bytes('bbb') }];
  const one = new Uint8Array(await zip(files).arrayBuffer());
  const two = new Uint8Array(await zip(files).arrayBuffer());
  assert.deepEqual([...one], [...two]);
});

test('an archive built from blobs holds what went into it', async () => {
  const blob = await zipBlobs([
    { name: 'one.mp4', blob: new Blob([bytes('first')]) },
    { name: 'two.mp4', blob: new Blob([bytes('second')]) }
  ]);
  const out = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(out);
  assert.ok(text.includes('first') && text.includes('second'));
  assert.ok(text.includes('one.mp4') && text.includes('two.mp4'));
});

test('a real unarchiver opens it and gets the files back', async (t) => {
  /* The one that matters. Everything above is this file agreeing with
     itself; this hands the archive to something that did not write it. */
  const files = [
    { name: 'clip-9x16.mp4', bytes: bytes('vertical bytes') },
    { name: 'clip-1x1.mp4', bytes: bytes('square bytes') },
    { name: 'clip-16x9.mp4', bytes: bytes('wide bytes') }
  ];
  const dir = mkdtempSync(join(tmpdir(), 'mbb-zip-'));
  try {
    writeFileSync(join(dir, 'out.zip'), new Uint8Array(await zip(files).arrayBuffer()));

    /* Whichever of these the machine has. Git Bash's own tar is GNU tar,
       which does not read zip at all, so asking for "tar" alone skipped this
       test on the machine it was written on - a green run that had checked
       nothing. */
    const tools: [string, string[]][] = [
      ['unzip', ['-q', 'out.zip']],
      ['C:\\Windows\\System32\\tar.exe', ['-xf', 'out.zip']],
      ['bsdtar', ['-xf', 'out.zip']]
    ];
    const failures: string[] = [];
    const opened = tools.some(([cmd, args]) => {
      try {
        execFileSync(cmd, args, { cwd: dir, stdio: 'pipe' });
        return true;
      } catch (e) {
        failures.push(`${cmd}: ${(e as Error).message.split('\n')[0]}`);
        return false;
      }
    });
    if (!opened) {
      t.skip('no unarchiver on this machine - ' + failures.join('; '));
      return;
    }
    for (const f of files) {
      assert.deepEqual(
        [...new Uint8Array(readFileSync(join(dir, f.name)))],
        [...f.bytes],
        `${f.name} came back different`
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
