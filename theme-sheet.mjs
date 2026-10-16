#!/usr/bin/env node
/* One still of the bill wearing every theme, and a contact sheet of the lot.
 *
 *   node theme-sheet.mjs
 *
 * Theme art is the one part of this studio nobody can check by reading the
 * code: whether a picture sits well behind a bill, and whether the bill is
 * still readable over it, are things you have to look at. Sixteen festivals
 * and two variants each is more than anybody will open one at a time, so they
 * go on one sheet.
 *
 * A festival with no art shows its tinted card, which is what the Theme Store
 * does too - so the sheet also says, at a glance, what has been supplied and
 * what has not.
 */

import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { compile } from './worker/compile.js';
import { FESTIVE_THEMES } from './src/themes.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'out', 'themes');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'
};

function serveRepo() {
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    try {
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' });
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

/* A bill with enough on it to judge a background against: two lines, taxes,
 * a total in words. Every name and figure is invented. */
const RECIPE = `
video: theme-sheet
business:
  name: SAGAR SUPERBAZAAR
party:
  name: ASHOK TRADING CO
  phone: "98765 43210"
  address: Sadar Bazaar, Agra
invoice:
  number: 5949
  date: "16/10/2026"
  theme: none
items:
  - { name: SUGAR 5KG, rate: 310, qty: 2, gst: 5, unit: PKT }
  - { name: TATA SALT 1KG, rate: 28, qty: 6, gst: 5, unit: PKT }
shots:
  - screen: invoice-created
    duration: 2
    actions: []
`;

function ffmpegPath() {
  const guesses = [
    join(homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    join(homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages',
      'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'ffmpeg-9.0.2-full_build', 'bin', 'ffmpeg.exe')
  ];
  return guesses.find(p => existsSync(p)) || 'ffmpeg';
}

const { recipe, errors } = await compile(RECIPE);
if (errors) {
  console.error(errors.join('\n'));
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const { server, origin } = await serveRepo();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.setTime === 'function');

/* Both variants, because the second is a different picture and the whole
 * point of the sheet is seeing the pictures. */
const wanted = [];
for (const theme of FESTIVE_THEMES) {
  wanted.push({ ...theme, variant: 1 });
  if (existsSync(join(ROOT, 'kit', 'themes', `${theme.slug}-2.jpg`))
    || existsSync(join(ROOT, 'kit', 'themes', `${theme.slug}-2.png`))) {
    wanted.push({ ...theme, variant: 2 });
  }
}

const shots = [];
for (const { slug, name, variant } of wanted) {
  /* The second variant is CHOSEN, not configured: there is nowhere in a
   * recipe to ask for it, because in a real clip it comes from tapping the
   * chip in the Theme Store. So the sheet taps it too - a Theme Store shot
   * that picks the chip, then the bill, which is exactly the journey being
   * checked. The theme and the variant both survive the cut because
   * theme-store persists them. */
  const shotList = variant === 2
    ? [
        { screen: 'theme-store', duration: 1.2, actions: [{ at: 0.2, do: 'tap', target: 'variant-2' }] },
        { screen: 'invoice-created', duration: 2, actions: [] }
      ]
    : [{ screen: 'invoice-created', duration: 2, actions: [] }];

  await page.evaluate(r => window.mount(r), {
    ...recipe,
    invoice: { ...recipe.invoice, theme: slug },
    shots: shotList
  });
  await page.evaluate(() => window.stageReady);
  await page.evaluate(t => window.setTime(t), variant === 2 ? 2.2 : 1);
  await page.waitForTimeout(120);

  const file = join(OUT, `${slug}${variant === 2 ? '-2' : ''}.png`);
  const el = await page.$('#viewport');
  await el.screenshot({ path: file });
  shots.push({ file, label: `${name}${variant === 2 ? ' 2' : ''}` });
  process.stdout.write('.');
}

await browser.close();
await new Promise(resolve => server.close(resolve));

/* The contact sheet: every bill on one picture, four across. */
const list = join(OUT, 'sheet.txt');
await writeFile(list, shots.map(s => `file '${s.file.replace(/\\/g, '/')}'`).join('\n'));

const sheet = join(OUT, 'all-themes.png');
const ff = spawnSync(ffmpegPath(), [
  '-y', '-f', 'concat', '-safe', '0', '-i', list,
  '-filter_complex', `scale=360:-1,tile=4x${Math.ceil(shots.length / 4)}:padding=12:margin=12:color=white`,
  '-frames:v', '1', sheet
], { stdio: 'inherit' });

console.log(`\n${shots.length} bills -> ${OUT}`);
if (ff.status === 0) console.log(`contact sheet -> ${sheet}`);
else console.log('(ffmpeg could not build the contact sheet; the single stills are there)');
