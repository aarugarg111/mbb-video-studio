/* Turning recipe text into a recipe, the one way.
 *
 * Both the command line and the render service do this, and the two must agree
 * exactly: which themes count as real depends on what art is sitting in
 * kit/themes, and whether the CTA card appears depends on whether its image is
 * there. A second copy of those two lookups would mean a clip that renders on
 * one path and warns on the other.
 */

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parse, BUILT_IN_THEMES } from '../src/recipe.js';
import { catalogue, scrollables } from '../screens/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function compile(text) {
  /* Theme art dropped into kit/themes/ becomes a valid theme name. Both
   * extensions: the art is photographic and arrives as JPEG, and this looked
   * for .png only - which it had never had to be right about, because until
   * the first pictures arrived the folder held nothing but a README. */
  const art = (await readdir(join(ROOT, 'kit', 'themes')).catch(() => []))
    .filter(f => /.(png|jpe?g|webp)$/i.test(f))
    .map(f => f.replace(/.[^.]+$/, ''));

  return parse(text, catalogue(), {
    themes: [...BUILT_IN_THEMES, ...art],
    scrollable: scrollables(),
    ctaImage: existsSync(join(ROOT, 'kit', 'cta', 'download-now.png'))
  });
}
