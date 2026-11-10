import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFontFaces, FONT_SUBSETS, loadAssets } from './assets';

test('a font face embeds the bytes rather than a path', () => {
  const css = buildFontFaces({ latin: 'AAAA', 'latin-ext': 'BBBB' });
  assert.match(css, /data:font\/woff2;base64,AAAA/);
  assert.doesNotMatch(css, /\.woff2/, 'no path may survive - it would not load');
});

test('every declared subset gets a face', () => {
  const css = buildFontFaces({ latin: 'AAAA', 'latin-ext': 'BBBB' });
  const faces = css.match(/@font-face/g) ?? [];
  assert.equal(faces.length, FONT_SUBSETS.length);
});

test('the rupee sign is covered by a declared range', () => {
  const covered = FONT_SUBSETS.some(s => s.range.includes('U+20B9'));
  assert.ok(covered, 'the bill is full of rupee signs; losing them is not subtle');
});

/* "Failed to fetch" at the render stage, from the live studio. Three words
 * naming no file, no step and nothing to try - for any one of six requests
 * the renderer makes. */
test('an asset that will not load names itself', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;

  try {
    await assert.rejects(loadAssets(), (err: Error) => {
      assert.match(err.message, /Could not load/);
      assert.match(err.message, /\/kit\//, 'the file is named, which is the whole diagnosis');
      assert.match(err.message, /did not complete/);
      assert.match(err.message, /network|extension|offline/, 'and what to suspect');
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* One dropped connection used to poison the page: the rejected promise stayed
 * memoised, so every later render failed with the same stale error and
 * pressing the button again could not possibly work. */
test('a failed load is forgotten, so pressing render again can succeed', async () => {
  const realFetch = globalThis.fetch;
  let attempt = 0;

  const bytes = new Uint8Array([1, 2, 3]);
  globalThis.fetch = (async () => {
    attempt++;
    if (attempt <= 6) throw new TypeError('Failed to fetch');
    return {
      ok: true,
      status: 200,
      text: async () => 'body{}',
      arrayBuffer: async () => bytes.buffer
    } as unknown as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(loadAssets(), /Could not load/);
    const assets = await loadAssets();
    assert.match(assets.css, /body\{\}/, 'the second attempt is a real attempt');
  } finally {
    globalThis.fetch = realFetch;
  }
});
