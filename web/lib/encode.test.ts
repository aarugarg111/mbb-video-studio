import test from 'node:test';
import assert from 'node:assert/strict';
import { CODEC, keyFrameEvery, timestampFor } from './encode';

test('the codec is baseline h264, which plays everywhere', () => {
  assert.equal(CODEC, 'avc1.42001f');
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
