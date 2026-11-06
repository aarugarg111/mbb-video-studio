/* When the ring is drawn, is the thing underneath it the thing being tapped?
 *
 * test/tap-lands-on-something.test.js answers half of this from the markup: it
 * catches a tap whose effect DELETES its own target. The other half cannot be
 * seen in markup at all. Tapping "+ Add Item" opens the item picker, and the
 * picker is a panel laid over the middle of the screen - including over the
 * button that opened it. The button is still in the page, so a markup test
 * finds it and is satisfied; on camera the ring is drawn in the middle of a
 * modal, pointing at nothing, and the clip looks like it clicked a blank patch
 * of a dialog.
 *
 * Answering it needs real layout, so this one runs the browser: it mounts the
 * screen, moves to the moment the ring is on, and asks the page what is at
 * that point. Whatever comes back has to be the target or part of it.
 *
 * This is the test for the whole family of "the tap clicked somewhere else"
 * faults, which have now shown up three times - the share menu closing under
 * its own ring, the picker covering its own button, and before either of them
 * a set of coordinates measured against the wrong viewport. None of them made
 * any test fail and all of them were plain in the first rendered frame.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { SCREENS } from '../screens/index.js';
import { deviceOf, viewportFor } from '../src/device.js';

const ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2'
};

const DATA = {
  business: { name: 'Agarwal Super Market', gstin: '09ABCDE1234F1Z5' },
  party: { name: 'Ramesh Kumar', phone: '98765 43210' },
  invoice: { number: 5945 },
  items: [
    { name: 'TATA SALT 1KG', rate: 28, qty: 10, purchase: 24, stock: 8 },
    { name: 'SUGAR 5KG', rate: 310, qty: 2, purchase: 272, stock: 4 }
  ]
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

const has = (html, id) => html.includes(`id="${id}"`);

/* The one earlier tap on this screen, if any, that puts the target on screen:
 * you cannot press WhatsApp without having opened the share menu. */
function prerequisiteFor(screen, target) {
  if (has(screen.render(DATA, {}), target)) return null;
  for (const [name, effect] of Object.entries(screen.tapEffects ?? {})) {
    if (name === target) continue;
    if (has(screen.render(DATA, effect), target)) return name;
  }
  return undefined; // nothing reaches it
}

/* Every tap that changes its own screen - those are the ones that can bury
 * themselves. A tap with no effect leaves the screen as it was.
 *
 * Grouped by device, because a laptop screen and a phone screen cannot be
 * measured in the same page: mounting a phone leaves the laptop's frame
 * hidden and therefore sizeless, and every rect read off it afterwards is
 * nonsense that still looks like numbers. measure-targets.mjs carries the
 * same warning, and this test was written ignoring it - it reported seven
 * perfectly good targets as being off the side of the screen. */
function tapsByDevice() {
  const groups = { phone: [], desktop: [] };
  for (const [name, screen] of Object.entries(SCREENS)) {
    for (const target of Object.keys(screen.tapEffects ?? {})) {
      if (!screen.targets?.[target]) continue;
      const prereq = prerequisiteFor(screen, target);
      if (prereq === undefined) continue;
      groups[deviceOf(screen)].push({ screen: name, target, prereq });
    }
  }
  return groups;
}

test('the ring lands on the button, not on what the button opened', async (t) => {
  t.diagnostic('this launches a browser; it is slower than the unit tests');

  const { server, origin } = await serveRepo();
  const browser = await chromium.launch();
  const wrong = [];

  try {
    for (const taps of Object.values(tapsByDevice())) {
      if (!taps.length) continue;
      /* A page of its own per device - see tapsByDevice. */
      const page = await browser.newPage({
        viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1
      });
      await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof window.setTime === 'function');

      await checkAll(page, taps, wrong);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  assert.deepEqual(
    wrong, [],
    'a ring drawn over something other than the button it is meant to be ' +
    'pressing. If the tap opens a panel that covers it, add the tap to that ' +
    'screen\'s `dismisses` so the panel waits for the ring:\n  ' + wrong.join('\n  ')
  );
});

async function checkAll(page, taps, wrong) {
  for (const { screen, target, prereq } of taps) {
    const mod = SCREENS[screen];
    const actions = [];
    if (prereq) actions.push({ at: 0.4, do: 'tap', target: prereq });
    actions.push({ at: 1.4, do: 'tap', target });

    await page.evaluate(r => window.mount(r), {
        ...DATA, shots: [{ screen, duration: 2.6, actions }], brand: { cta: false }
      });
    await page.evaluate(() => window.stageReady);
      /* Just after the tap, while the ring is on and at its smallest - the
         moment a viewer reads as the press. */
    await page.evaluate(() => window.setTime(1.5));

    const box = viewportFor(mod);
    const vpId = deviceOf(mod) === 'desktop' ? 'desktop-viewport' : 'viewport';
    const hit = await page.evaluate(({ id, vpId, box }) => {
        const vp = document.getElementById(vpId).getBoundingClientRect();
        const el = document.getElementById(id);
        if (!el) return { gone: true };
        const r = el.getBoundingClientRect();
        /* The ring is drawn at the element's centre, so that is the point to
           ask about. The ring itself does not take pointer events. */
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!at) return { nothing: true };
        const covering = at.closest(`#${CSS.escape(id)}`);
        return {
          ok: Boolean(covering) || el.contains(at),
          /* What IS on top, named as helpfully as the page allows. */
          by: at.id || at.className || at.tagName,
          offstage: r.right < vp.left || r.left > vp.right || r.bottom < vp.top || r.top > vp.bottom
        };
    }, { id: target, vpId, box });

    if (hit.gone) wrong.push(`${screen}: ${target} is not on the page when it is tapped`);
    else if (hit.offstage) wrong.push(`${screen}: ${target} is outside the screen when it is tapped`);
    else if (hit.nothing) wrong.push(`${screen}: nothing at all is under the ring on ${target}`);
    else if (!hit.ok) wrong.push(`${screen}: the ring on ${target} lands on "${hit.by}" instead`);
  }
}
