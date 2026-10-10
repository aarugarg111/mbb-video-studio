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
import { catalogue } from '../screens/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function compile(text) {
  /* Theme art dropped into kit/themes/<name>.png becomes a valid theme name. */
  const art = (await readdir(join(ROOT, 'kit', 'themes')).catch(() => []))
    .filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));

  return parse(text, catalogue(), {
    themes: [...BUILT_IN_THEMES, ...art],
    ctaImage: existsSync(join(ROOT, 'kit', 'cta', 'download-now.png'))
  });
}
