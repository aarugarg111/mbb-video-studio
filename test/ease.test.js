import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp01, lerp, easeOut, easeInOut, ramp } from '../src/ease.js';

test('clamp01 bounds to zero and one', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(7), 1);
});

test('lerp interpolates between endpoints', () => {
  assert.equal(lerp(0, 100, 0), 0);
  assert.equal(lerp(0, 100, 0.5), 50);
  assert.equal(lerp(0, 100, 1), 100);
});

test('easing curves pin both ends', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
});

test('easeOut starts fast', () => {
  assert.ok(easeOut(0.25) > 0.25, 'expected easeOut to lead a linear ramp early');
});

test('easing curves clamp out-of-range input', () => {
  assert.equal(easeOut(-1), 0);
  assert.equal(easeInOut(4), 1);
});

test('ramp converts absolute time to progress', () => {
  assert.equal(ramp(1.0, 2.0, 0.5), 0, 'before the start');
  assert.equal(ramp(2.25, 2.0, 0.5), 0.5, 'halfway');
  assert.equal(ramp(9.0, 2.0, 0.5), 1, 'after the end');
});

test('ramp with zero duration is instantaneous', () => {
  assert.equal(ramp(1.9, 2.0, 0), 0);
  assert.equal(ramp(2.0, 2.0, 0), 1);
});
