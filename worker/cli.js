#!/usr/bin/env node
/* recipe in, mp4 (or a single still) out. */

import { readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { compile } from './compile.js';
import { renderFrames, renderStill } from './render.js';
import { encode } from './encode.js';

const FPS = 30;

async function main() {
  const [recipePath, ...rest] = process.argv.slice(2);

  if (!recipePath) {
    console.error('Usage: node worker/cli.js <recipe.yaml> [--still <seconds>]');
    process.exit(1);
  }

  const stillIndex = rest.indexOf('--still');
  const stillAt = stillIndex >= 0 ? Number(rest[stillIndex + 1]) : null;

  const text = await readFile(recipePath, 'utf8');
  const result = await compile(text);

  for (const warning of result.warnings) console.warn('warning: ' + warning);

  if (result.errors) {
    console.error('\nThis recipe cannot be rendered:\n');
    for (const e of result.errors) console.error('  - ' + e);
    process.exit(1);
  }

  const { recipe } = result;
  const outDir = join('out', recipe.video);
  await mkdir(outDir, { recursive: true });

  if (stillAt !== null) {
    const stillPath = join(outDir, `still-${stillAt}s.png`);
    await renderStill(recipe, stillAt, stillPath);
    console.log('Still: ' + stillPath);
    return;
  }

  const framesDir = join(outDir, 'frames');
  await mkdir(framesDir, { recursive: true });

  console.log('Rendering frames...');
  const frames = await renderFrames(recipe, framesDir, { fps: FPS });
  console.log(`${frames} frames.`);

  const mp4 = join(outDir, recipe.video + '.mp4');
  console.log('Encoding...');
  await encode(framesDir, mp4, { fps: FPS });

  /* Frames are only worth keeping when something went wrong. */
  await rm(framesDir, { recursive: true, force: true });

  console.log('\nDone: ' + mp4);
}

main().catch(err => {
  console.error('\n' + err.message);
  process.exit(1);
});
