/* A static export can only fetch what is inside public/. The kit lives at the
 * repository root because the renderer and the CLI share it, so copy it in
 * rather than keeping a second copy that would drift. */

import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const dest = join(here, '..', 'public', 'kit');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

for (const entry of ['tokens.css', 'kit.css', 'fonts', 'brand', 'themes']) {
  await cp(join(repo, 'kit', entry), join(dest, entry), { recursive: true });
}

console.log('copied kit/ into web/public/kit/');
