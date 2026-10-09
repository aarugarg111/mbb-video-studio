import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/* Baseline profile, level 4.2 (3.1 caps the frame at 921600 px; 1080x1920 needs more). Higher profiles encode a little smaller but
 * are refused by some editors and older players; this one is universal. */
export const CODEC = 'avc1.42002a';

export const keyFrameEvery = (fps: number) => fps;
export const timestampFor = (frame: number, fps: number) =>
  Math.round((frame / fps) * 1_000_000);

export function isSupported(): boolean {
  return typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoFrame' in window;
}

export type Encoder = {
  addFrame(canvas: HTMLCanvasElement, index: number): Promise<void>;
  finish(): Promise<Blob>;
};

export async function createEncoder(
  { width, height, fps }: { width: number; height: number; fps: number }
): Promise<Encoder> {
  if (!isSupported()) {
    throw new Error(
      'This browser cannot encode video. Chrome or Edge is needed — Safari does not support WebCodecs H.264 encoding.'
    );
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory'
  });

  let failure: Error | null = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { failure = e instanceof Error ? e : new Error(String(e)); }
  });

  encoder.configure({
    codec: CODEC,
    width,
    height,
    framerate: fps,
    /* Flat UI compresses extremely well - large areas of solid colour with
     * sharp text. 6 Mbps produced a 4.7 MB clip where ffmpeg made 0.5 MB at
     * visually identical quality. 2 Mbps keeps text edges crisp without the
     * bloat. */
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
      await encoder.flush();
      if (failure) throw failure;
      encoder.close();
      muxer.finalize();
      const { buffer } = muxer.target as ArrayBufferTarget;
      return new Blob([buffer], { type: 'video/mp4' });
    }
  };
}
