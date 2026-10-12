import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/* Baseline profile, level 4.2 (3.1 caps the frame at 921600 px; 1080x1920 needs more). Higher profiles encode a little smaller but
 * are refused by some editors and older players; this one is universal. */
export const CODEC = 'avc1.42002a';

export const keyFrameEvery = (fps: number) => fps;
export const timestampFor = (frame: number, fps: number) =>
  Math.round((frame / fps) * 1_000_000);

/* Whether the objects exist at all. Necessary and nowhere near sufficient:
 * Safari 26 has VideoEncoder and VideoFrame, passes this, and then cannot
 * actually encode H.264 - the failure surfaces deep inside the muxer as
 * "null is not an object (evaluating 't.info.decoderConfig.colorSpace')",
 * which names neither Safari nor the codec. Use canEncode below for anything
 * that decides whether to offer a render. */
export function isSupported(): boolean {
  return typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoFrame' in window;
}

/* Asks the browser whether it can really encode what we are about to ask for,
 * rather than whether the words exist. This is the honest check, and it is
 * asynchronous because the specification made it so. */
export async function canEncode(
  { width, height, fps }: { width: number; height: number; fps: number }
): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    const encoder = VideoEncoder as unknown as {
      isConfigSupported?: (c: VideoEncoderConfig) => Promise<{ supported?: boolean }>;
    };
    /* An older browser with no isConfigSupported is taken at its word - it is
     * the browsers that answer this question that we need protecting from. */
    if (typeof encoder.isConfigSupported !== 'function') return true;
    const { supported } = await encoder.isConfigSupported({ codec: CODEC, width, height, framerate: fps });
    return supported === true;
  } catch {
    return false;
  }
}

export type Encoder = {
  addFrame(canvas: HTMLCanvasElement, index: number): Promise<void>;
  finish(): Promise<Blob>;
};

export async function createEncoder(
  { width, height, fps }: { width: number; height: number; fps: number }
): Promise<Encoder> {
  if (!await canEncode({ width, height, fps })) {
    throw new Error(
      'This browser cannot make H.264 video. Safari says it can and then cannot, which is why ' +
      'this is checked rather than assumed. Use Chrome or Edge on a computer.'
    );
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory'
  });

  let failure: Error | null = null;
  let seenConfig = false;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      /* The muxer needs the decoder configuration that comes with the first
       * chunk. A browser that encodes but never sends one takes the muxer down
       * from the inside, with a message naming a property rather than a cause.
       * Caught here, where it can say what actually happened. */
      if (!seenConfig) {
        if (!meta?.decoderConfig) {
          failure = new Error(
            'This browser produced video it could not describe, so the file cannot be assembled. ' +
            'That is a limitation of the browser rather than of the clip - use Chrome or Edge on a computer.'
          );
          return;
        }
        seenConfig = true;
      }
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (e) {
        failure = e instanceof Error ? e : new Error(String(e));
      }
    },
    error: e => { failure = e instanceof Error ? e : new Error(String(e)); }
  });

  encoder.configure({
    codec: CODEC,
    width,
    height,
    framerate: fps,
    /* Measured against the ffmpeg render, frame by frame.
     *
     * On static frames every bitrate from 1 Mbps up is pixel-identical. On a
     * fast transition about 0.2% of the image differs - and that floor stays
     * at 4 Mbps, so most of it is WebCodecs and libx264 simply making
     * different choices, not a shortage of bits. 1 Mbps adds a little on top
     * (0.26% vs 0.19%); 4 Mbps buys almost nothing for another 200 KB.
     *
     * 2 Mbps sits at the knee: ~2.2 MB for a 13s clip, no visible difference
     * from the ffmpeg output. */
    bitrate: 2_000_000
  });

  const gop = keyFrameEvery(fps);

  return {
    async addFrame(canvas, index) {
      if (failure) throw failure;

      const frame = new VideoFrame(canvas, { timestamp: timestampFor(index, fps) });
      encoder.encode(frame, { keyFrame: index % gop === 0 });
      frame.close();

      /* Without this the encoder queue grows unbounded and a long clip
       * exhausts memory before a single chunk is written. */
      if (encoder.encodeQueueSize > 8) {
        await new Promise<void>(resolve => {
          const check = () =>
            encoder.encodeQueueSize <= 2 ? resolve() : setTimeout(check, 4);
          check();
        });
      }
    },

    async finish() {
      /* flush can itself throw on a browser that got this far and still
       * cannot finish, and that error is no more readable than the muxer's. */
      try {
        await encoder.flush();
      } catch (e) {
        throw failure ?? (e instanceof Error ? e : new Error(String(e)));
      }
      if (failure) throw failure;
      encoder.close();
      muxer.finalize();
      const { buffer } = muxer.target as ArrayBufferTarget;
      return new Blob([buffer], { type: 'video/mp4' });
    }
  };
}
