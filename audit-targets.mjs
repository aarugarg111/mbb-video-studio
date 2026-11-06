#!/usr/bin/env node
/* Every tap target on every screen, checked against a real render.
 *
 *   node audit-targets.mjs
 *
 * measure-targets.mjs answers "where is this one?" for a screen you are
 * working on. This answers "is every one of them right?" for all of them at
 * once, and it asks three different questions, because a tap has gone wrong
 * here in three different ways:
 *
 *   MISSING  - the id is in `targets` but no element carries it, so the ring
 *              is drawn at a coordinate belonging to nothing.
 *   DRIFT    - the declared coordinate is no longer where the element is,
 *              because the screen was rebuilt and the numbers were not.
 *   COVERED  - the element is there, at that spot, with something else on top
 *              of it: a modal, a scrim, a sheet.
 *
 * Phone screens and laptop screens are audited in separate browser pages. A
 * laptop frame mounted after a phone one is hidden and therefore sizeless,
 * and every rect read off it afterwards is nonsense that still looks like
 * numbers.
 */

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { SCREENS } from './screens/index.js';
import { deviceOf, viewportFor } from './src/device.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2'
};

/* Enough of a shop to draw any screen in the studio. */
const DATA = {
  business: { name: 'SHREE KIRANA STORE', gstin: '09ABCDE1234F1Z5',
              address: 'Station Road, Lucknow, Uttar Pradesh, 226001' },
  party: { name: 'RAKESH KUMAR TRADERS', phone: '98765 43210',
           address: 'Aminabad, Lucknow, Uttar Pradesh, 226018', balance: 21846 },
  invoice: { number: 2301 },
  items: [
    { name: 'SUGAR 5KG', rate: 230, qty: 2, gst: 5, unit: 'PCS', purchase: 198, stock: 46 },
    { name: 'TATA SALT 1KG', rate: 28, qty: 10, gst: 5, unit: 'PCS', purchase: 24, stock: 8 }
  ]
};

/* How far a declared coordinate may sit from the element's real centre.
 * Eight is what measure-targets.mjs treats as worth mentioning. */
const TOLERANCE = 8;

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

/* The state this target needs to be on screen at all: none, one of the
 * screen's own tap effects, or two of them together. */
function revealingState(screen, target) {
  if (has(screen.render(DATA, {}), target)) return {};
  const others = Object.entries(screen.tapEffects ?? {})
    .filter(([name]) => name !== target)
    .map(([, effect]) => effect);
  for (const a of others) if (has(screen.render(DATA, a), target)) return { ...a };
  for (const a of others) for (const b of others) {
    const both = { ...a, ...b };
    if (has(screen.render(DATA, both), target)) return both;
  }
  return null;
}

/* Runs the whole audit and hands back what it found, so the test suite can
 * fail on it and the command line can print it. */
export async function auditTargets() {
const { server, origin } = await serveRepo();
const browser = await chromium.launch();
const findings = [];
let checked = 0;

const byDevice = { phone: [], desktop: [] };
for (const [name, screen] of Object.entries(SCREENS)) {
  for (const target of Object.keys(screen.targets ?? {})) {
    byDevice[deviceOf(screen)].push({ screen: name, target });
  }
}

for (const [device, wanted] of Object.entries(byDevice)) {
  if (!wanted.length) continue;
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1
  });
  await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.setTime === 'function');

  for (const { screen, target } of wanted) {
    const mod = SCREENS[screen];
    checked++;

    const state = revealingState(mod, target);
    if (state === null) {
      findings.push({ kind: 'MISSING', screen, target, note: 'no element carries this id' });
      continue;
    }

    /* Mounted carrying whichever of its own taps the target needs, so a
       button inside a menu is measured with the menu open. */
    const actions = Object.entries(mod.tapEffects ?? {})
      .filter(([, effect]) => Object.entries(effect)
        .every(([k, v]) => state[k] === v) && Object.keys(effect).length)
      .map(([name], i) => ({ at: 0.3 + i * 0.3, do: 'tap', target: name }))
      .filter(a => mod.targets?.[a.target]);

    await page.evaluate(r => window.mount(r), {
      ...DATA, shots: [{ screen, duration: 4, actions }], brand: { cta: false }
    });
    await page.evaluate(() => window.stageReady);
    await page.evaluate(() => window.setTime(3.0));

    const box = viewportFor(mod);
    const vpId = device === 'desktop' ? 'desktop-viewport' : 'viewport';
    const seen = await page.evaluate(({ id, vpId, box }) => {
      const vp = document.getElementById(vpId).getBoundingClientRect();
      const el = document.getElementById(id);
      if (!el) return { gone: true };
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return { sizeless: true };
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      /* Where this target's INK is - its icons and its words - as opposed to
         where its BOX is. A menu row is as wide as the menu and its contents
         sit at the left, so the middle of the box is blank, and a ring drawn
         there lands beside the thing the target names rather than on it.
         That is what "the tap is somewhere else" turned out to mean on the
         share menu: the coordinate was right, the element was right, and the
         ring was still pressing nothing. */
      let ink = null;
      const add = box2 => {
        if (!box2 || !box2.width || !box2.height) return;
        ink = ink
          ? { left: Math.min(ink.left, box2.left), top: Math.min(ink.top, box2.top),
              right: Math.max(ink.right, box2.right), bottom: Math.max(ink.bottom, box2.bottom) }
          : { left: box2.left, top: box2.top, right: box2.right, bottom: box2.bottom };
      };
      for (const node of el.childNodes) {
        if (node.nodeType === 1) add(node.getBoundingClientRect());
        else if (node.nodeType === 3 && node.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          add(range.getBoundingClientRect());
        }
      }
      /* No children at all - an empty box, or one drawn entirely by its own
         background. Its middle is then the best answer there is. */
      const onInk = !ink ||
        (cx >= ink.left && cx <= ink.right && cy >= ink.top && cy <= ink.bottom);

      const at = document.elementFromPoint(cx, cy);
      return {
        onInk,
        x: Math.round((cx - vp.left) * (box.width / vp.width)),
        y: Math.round((cy - vp.top) * (box.height / vp.height)),
        /* elementFromPoint answers nothing for a point outside the picture.
           That is not something lying on top of the button - it is the button
           being off the edge of the frame, which a laptop's left rail is on
           purpose in a 9:16 video. The two need different words or the second
           reads as a bug in the first's language. */
        offFrame: !at,
        onTop: Boolean(at) && (at.closest(`#${CSS.escape(id)}`) !== null || el.contains(at)),
        by: at ? (at.id || at.className || at.tagName) : null
      };
    }, { id: target, vpId, box });

    if (seen.gone) {
      findings.push({ kind: 'MISSING', screen, target, note: 'not in the page when mounted' });
      continue;
    }
    if (seen.sizeless) {
      findings.push({ kind: 'MISSING', screen, target, note: 'has no size, so no place' });
      continue;
    }

    const want = mod.targets[target];
    const drift = Math.max(Math.abs(want.x - seen.x), Math.abs(want.y - seen.y));
    if (drift > TOLERANCE) {
      findings.push({
        kind: 'DRIFT', screen, target,
        note: `declared ${want.x},${want.y} but drawn at ${seen.x},${seen.y} - out by ${drift}px`
      });
    }
    if (seen.offFrame) {
      findings.push({
        kind: 'OFFFRAME', screen, target,
        note: 'outside the picture at this shape - a ring here would be filmed off the edge'
      });
    } else if (!seen.onTop) {
      findings.push({
        kind: 'COVERED', screen, target, note: `"${seen.by}" is on top of it`
      });
    } else if (!seen.onInk) {
      findings.push({
        kind: 'EMPTY', screen, target,
        note: 'the middle of this target is blank - the ring lands beside its ' +
              'icon and words rather than on them. Put the id on the part a ' +
              'person would say they were pointing at.'
      });
    }
  }
  await page.close();
}

await browser.close();
await new Promise(resolve => server.close(resolve));

const order = ['MISSING', 'COVERED', 'EMPTY', 'DRIFT', 'OFFFRAME'];
findings.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)
  || a.screen.localeCompare(b.screen));
return { findings, checked };
}

/* Printed only when run as a command, not when the test suite imports it. */
if (process.argv[1] && process.argv[1].endsWith('audit-targets.mjs')) {
const { findings, checked } = await auditTargets();

console.log(`\n${checked} targets checked across ${Object.keys(SCREENS).length} screens.`);
if (!findings.length) {
  console.log('Every one of them is where it says it is, with nothing on top.\n');
} else {
  console.log(`${findings.length} to look at:\n`);
  for (const f of findings) {
    console.log(`  ${f.kind.padEnd(8)} ${f.screen} / ${f.target}\n           ${f.note}`);
  }
  console.log('');
}
}
