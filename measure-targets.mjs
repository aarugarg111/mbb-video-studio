#!/usr/bin/env node
/* Measures where a screen's tap targets actually are.
 *
 * Tap coordinates are in the viewport's own 390x844 space, but the phone is
 * drawn at scale(1.8), so a rect read off the page has to be divided back
 * down. Estimating these by eye has been wrong here by 44, 55, 86 and 230
 * pixels, every one of which put a ripple somewhere a finger never went.
 *
 *   node measure-targets.mjs <recipe.yaml> <screen> [more screens...]
 *
 * It prints a targets block ready to paste, listing only the ids the screen
 * actually emits - an id in `targets` with no element behind it cannot be
 * tapped and nothing otherwise complains.
 */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { compile } from './worker/compile.js';
import { SCREENS } from './screens/index.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2'
};

function serveRepo() {
  const server = createServer(async (req, res) => {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[/\\]+/, '');
    const full = join(ROOT, rel);
    if (full !== ROOT && !full.startsWith(ROOT + sep)) return void res.writeHead(403).end();
    try {
      const body = await readFile(full);
      res.writeHead(200, { 'Content-Type': TYPES[extname(full)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const [recipePath, ...screens] = process.argv.slice(2);
if (!recipePath || !screens.length) {
  console.error('Usage: node measure-targets.mjs <recipe.yaml> <screen> [screen...]');
  process.exit(1);
}

const { recipe, errors } = await compile(await readFile(recipePath, 'utf8'));
if (errors) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const { server, origin } = await serveRepo();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.setTime === 'function');

for (const screen of screens) {
  const mod = SCREENS[screen];
  if (!mod) {
    console.error(`No such screen: ${screen}`);
    continue;
  }

  /* Mounted as a one-shot recipe of its own, so the screen is on camera at
   * t=0 whatever the real recipe's running order is. */
  await page.evaluate(r => window.mount(r), { ...recipe, shots: [{ screen, duration: 1, actions: [] }], brand: { cta: false } });
  await page.evaluate(() => window.stageReady);
  await page.evaluate(() => window.setTime(0.5));

  const ids = Object.keys(mod.targets ?? {});
  const measured = await page.evaluate(wanted => {
    const vp = document.getElementById('viewport').getBoundingClientRect();
    /* The phone is scaled about its centre, so the viewport's own rect is
       already in page pixels - dividing by its width recovers the 390-wide
       space the targets are written in. */
    const kx = 390 / vp.width;
    const ky = 844 / vp.height;
    const out = {};
    for (const id of wanted) {
      const el = document.getElementById(id);
      if (!el) { out[id] = null; continue; }
      const r = el.getBoundingClientRect();
      out[id] = {
        x: Math.round((r.left + r.width / 2 - vp.left) * kx),
        y: Math.round((r.top + r.height / 2 - vp.top) * ky)
      };
    }
    return out;
  }, ids);

  console.log(`\n/* ${screen} - MEASURED */\nexport const targets = {`);
  const lines = [];
  for (const [id, at] of Object.entries(measured)) {
    if (!at) {
      console.error(`  !! ${id}: no element with that id on ${screen} - it cannot be tapped`);
      continue;
    }
    const was = mod.targets[id];
    const drift = Math.max(Math.abs(was.x - at.x), Math.abs(was.y - at.y));
    lines.push(`  '${id}': { x: ${at.x}, y: ${at.y} }` + (drift > 8 ? `,  // was ${was.x},${was.y} - out by ${drift}px` : ','));
  }
  console.log(lines.join('\n').replace(/,$/, ''));
  console.log('};');
}

await browser.close();
await new Promise(resolve => server.close(resolve));
