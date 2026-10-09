import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFontFaces, FONT_SUBSETS } from './assets';

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
