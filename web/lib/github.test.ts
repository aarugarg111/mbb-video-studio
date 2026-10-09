import test from 'node:test';
import assert from 'node:assert/strict';
import { runNameFor, pickMp4 } from './github';
import { zipSync, strToU8 } from 'fflate';

test('the run name embeds the job id so a run can be found again', () => {
  assert.equal(runNameFor('abc-123'), 'render-abc-123');
});

test('pickMp4 pulls the video out of an artifact zip', () => {
  const zipped = zipSync({ 'video.mp4': strToU8('fake-mp4-bytes') });
  const out = pickMp4(zipped);
  assert.equal(new TextDecoder().decode(out), 'fake-mp4-bytes');
});

test('pickMp4 ignores other files in the zip', () => {
  const zipped = zipSync({
    'notes.txt': strToU8('ignore me'),
    'clip.mp4': strToU8('the video')
  });
  assert.equal(new TextDecoder().decode(pickMp4(zipped)), 'the video');
});

test('pickMp4 throws a clear error when the zip holds no video', () => {
  const zipped = zipSync({ 'notes.txt': strToU8('nothing here') });
  assert.throws(() => pickMp4(zipped), /no mp4/i);
});
