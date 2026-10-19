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
 * Measure laptop screens in a run of their own. Asking for a laptop screen
 * after a phone one leaves part of the laptop frame without a size, and
 * anything inside a clipping box on it - a scrolling list - reports as
 * untappable rather than as a wrong number.
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
import { deviceOf, viewportFor } from './src/device.js';

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
   * t=0 whatever the real recipe's running order is - but carrying the actions
   * the real recipe performs on it, because a target can be behind a state: the
   * item picker's rows do not exist until something opens the picker, and
   * measuring without the actions reported them as unreachable. */
  const own = recipe.shots.filter(s => s.screen === screen).flatMap(s => s.actions ?? []);
  const span = own.reduce((t, a) => Math.max(t, Number(a.at) || 0), 0) + 1.5;
  await page.evaluate(r => window.mount(r), { ...recipe, shots: [{ screen, duration: span, actions: own }], brand: { cta: false } });
  await page.evaluate(() => window.stageReady);

  /* A desktop screen is drawn in the browser-window frame and in its own
   * logical space, so both the element read and the numbers divided by have
   * to follow the screen rather than being assumed. */
  const box = viewportFor(mod);
  const vpId = deviceOf(mod) === 'desktop' ? 'desktop-viewport' : 'viewport';

  /* Walked through the shot rather than read at one instant, keeping the first
   * place each id is seen: an element that appears on one tap and goes on the
   * next is on camera for part of the shot and nowhere for the rest. */
  const measured = {};
  for (let t = 0.25; t <= span; t += 0.25) {
    await page.evaluate(at => window.setTime(at), Number(t.toFixed(2)));
    const found = await measureOnce(page, Object.keys(mod.targets ?? {}), vpId, box);
    for (const [id, at] of Object.entries(found)) if (at && !measured[id]) measured[id] = at;
  }
  for (const id of Object.keys(mod.targets ?? {})) if (!(id in measured)) measured[id] = null;

  /* Every target landing on one point is the signature of a screen that was
   * never laid out - measured while its frame was hidden, which happens when
   * a laptop screen is measured in the same run as a phone one. The numbers
   * look like numbers and are entirely wrong, so say so instead of printing
   * them. */
  const found = Object.values(measured).filter(Boolean);
  const identical = found.length > 2 && found.every(p => p.x === found[0].x && p.y === found[0].y);
  if (identical) {
    console.error(
      `\n!! ${screen}: every target measured to the same point ` +
      `(${found[0].x},${found[0].y}), which means the screen was not on ` +
      'camera when it was measured.\n   Measure it in a run of its own - a ' +
      'laptop screen and a phone screen cannot be measured together.'
    );
    continue;
  }

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

/* One pass of the page: where each wanted id is, in the screen's own pixels. */
async function measureOnce(page, wanted, vpId, box) {
  return page.evaluate(({ wanted, vpId, box }) => {
    const vp = document.getElementById(vpId).getBoundingClientRect();
    const kx = box.width / vp.width;
    const ky = box.height / vp.height;
    const out = {};
    for (const id of wanted) {
      const el = document.getElementById(id);
      if (!el) { out[id] = null; continue; }
      const r = el.getBoundingClientRect();
      /* An element with no size has no place. It happens while a shot is
       * still arriving - a list inside a clipping box is briefly zero-high,
       * and its rows all measure to the same point at the box's corner. The
       * numbers look like numbers and are entirely wrong, and because the
       * first sighting of a target is the one kept, they would be the ones
       * written down. */
      if (r.width === 0 || r.height === 0) { out[id] = null; continue; }
      out[id] = {
        x: Math.round((r.left + r.width / 2 - vp.left) * kx),
        y: Math.round((r.top + r.height / 2 - vp.top) * ky)
      };
    }
    return out;
  }, { wanted, vpId, box });
}
