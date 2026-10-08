import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderFrames } from '../worker/render.js';
import { encode } from '../worker/encode.js';

const RECIPE = {
  video: 'e2e',
  business: { name: 'Agarwal Super Market', gstin: '09ABCDE1234F1Z5' },
  party: { name: 'Ramesh Kumar', phone: '98765 43210' },
  items: [{ name: 'Tata Salt 1kg', rate: 28, qty: 10 }],
  shots: [
    { screen: 'home', duration: 1.0, actions: [{ at: 0.4, do: 'tap', target: 'create-invoice-cta' }] },
    { screen: 'create-invoice', duration: 1.0, actions: [{ at: 0.2, do: 'addItem', index: 0 }] }
  ]
};

test('a two-second recipe renders sixty frames and encodes to an mp4', async (t) => {
  t.diagnostic('this launches a browser and runs ffmpeg; it is slower than the unit tests');

  const dir = await mkdtemp(join(tmpdir(), 'mbb-e2e-'));
  try {
    const frames = await renderFrames(RECIPE, dir, { fps: 30 });
    assert.equal(frames, 60, 'two seconds at 30fps');

    const pngs = (await readdir(dir)).filter(f => f.endsWith('.png'));
    assert.equal(pngs.length, 60);

    const mp4 = join(dir, 'out.mp4');
    await encode(dir, mp4, { fps: 30 });

    const info = await stat(mp4);
    assert.ok(info.size > 1000, `expected a real mp4, got ${info.size} bytes`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
