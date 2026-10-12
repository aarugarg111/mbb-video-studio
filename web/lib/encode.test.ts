import test from 'node:test';
import assert from 'node:assert/strict';
import { CODEC, keyFrameEvery, timestampFor, canEncode } from './encode';

test('the codec is baseline h264, which plays everywhere', () => {
  assert.equal(CODEC, 'avc1.42002a');
});

test('timestamps are in microseconds', () => {
  assert.equal(timestampFor(0, 30), 0);
  assert.equal(timestampFor(30, 30), 1_000_000, 'frame 30 at 30fps is one second in');
  assert.equal(timestampFor(15, 30), 500_000);
});

test('a keyframe lands every second', () => {
  assert.equal(keyFrameEvery(30), 30);
  assert.equal(keyFrameEvery(25), 25);
});

test('frame zero is always a keyframe', () => {
  assert.equal(0 % keyFrameEvery(30), 0);
});

/* --- what Safari actually does --- */

test('a browser that has the words but cannot encode is refused', async () => {
  /* Safari 26 has VideoEncoder and VideoFrame and answers isConfigSupported
     with supported: false. The old check only asked whether the objects
     existed, so the studio promised a render and then died inside the muxer
     with "null is not an object (evaluating 't.info.decoderConfig.colorSpace')"
     - a message naming neither Safari nor H.264. */
  const original = globalThis.VideoEncoder;
  (globalThis as any).VideoEncoder = { isConfigSupported: async () => ({ supported: false }) };
  (globalThis as any).VideoFrame = class {};
  (globalThis as any).window = globalThis;
  try {
    assert.equal(await canEncode({ width: 1080, height: 1920, fps: 30 }), false);
  } finally {
    (globalThis as any).VideoEncoder = original;
  }
});

test('a browser that can encode is allowed', async () => {
  const original = globalThis.VideoEncoder;
  (globalThis as any).VideoEncoder = { isConfigSupported: async () => ({ supported: true }) };
  (globalThis as any).VideoFrame = class {};
  (globalThis as any).window = globalThis;
  try {
    assert.equal(await canEncode({ width: 1080, height: 1920, fps: 30 }), true);
  } finally {
    (globalThis as any).VideoEncoder = original;
  }
});

test('a browser too old to answer is taken at its word', async () => {
  /* It is the browsers that answer this question that we need protecting
     from; one that cannot answer predates the problem. */
  const original = globalThis.VideoEncoder;
  (globalThis as any).VideoEncoder = function () {};
  (globalThis as any).VideoFrame = class {};
  (globalThis as any).window = globalThis;
  try {
    assert.equal(await canEncode({ width: 1080, height: 1920, fps: 30 }), true);
  } finally {
    (globalThis as any).VideoEncoder = original;
  }
});

test('a browser with no WebCodecs at all is refused without asking', async () => {
  const original = globalThis.VideoEncoder;
  delete (globalThis as any).VideoEncoder;
  (globalThis as any).window = globalThis;
  try {
    assert.equal(await canEncode({ width: 1080, height: 1920, fps: 30 }), false);
  } finally {
    (globalThis as any).VideoEncoder = original;
  }
});

test('a check that throws is treated as a no', async () => {
  const original = globalThis.VideoEncoder;
  (globalThis as any).VideoEncoder = { isConfigSupported: async () => { throw new Error('nope'); } };
  (globalThis as any).VideoFrame = class {};
  (globalThis as any).window = globalThis;
  try {
    assert.equal(await canEncode({ width: 1080, height: 1920, fps: 30 }), false);
  } finally {
    (globalThis as any).VideoEncoder = original;
  }
});
