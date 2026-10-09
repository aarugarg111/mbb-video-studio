/* Renders the demo clip through the browser path — the real product route —
 * and saves it. Kept because it is how the browser output gets produced
 * without a human clicking through the page. */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const OUT = join(process.cwd(), 'web', 'out');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml'
};

const recipeFile = process.argv[2] ?? 'recipes/agarwal-fast-billing.yaml';
const outFile = process.argv[3] ?? 'out/browser-final.mp4';

const server = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    const f = join(OUT, p.replace(/^\/+/, ''));
    r.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
    r.end(await readFile(f));
  } catch { r.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const { parse } = await import('./src/recipe.js');
const { catalogue } = await import('./screens/index.js');
const parsed = parse(await readFile(recipeFile, 'utf8'), catalogue());
if (parsed.errors) { console.error(parsed.errors.join('\n')); process.exit(1); }
parsed.warnings.forEach(w => console.warn('warning: ' + w));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on('pageerror', e => console.error('page error:', e.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.renderVideo === 'function', null, { timeout: 15000 });

const b64 = await page.evaluate(async (recipe) => {
  const blob = await window.renderVideo(recipe, { fps: 30 });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}, parsed.recipe);

await writeFile(outFile, Buffer.from(b64, 'base64'));
console.log(`wrote ${outFile}`);

await browser.close();
server.close();
