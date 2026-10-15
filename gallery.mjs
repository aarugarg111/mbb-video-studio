#!/usr/bin/env node
/* Renders one still of every screen, for looking at them all at once.
 *
 * Opens the stage once and mounts each screen in turn rather than launching a
 * browser per screen, which turns four minutes into twenty seconds.
 *
 * Each screen is shown at the moment that says most about it: a filter applied,
 * a sheet open, a form filled. Those are listed below rather than guessed.
 */

import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { SCREENS, catalogue } from './screens/index.js';
import { deviceOf } from './src/device.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'out', 'gallery');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png',
  '.webp': 'image/webp'
};

/* A shop, a customer and a day's trade - enough for every screen to have
 * something true to show. All invented. */
const SHOP = {
  video: 'gallery',
  business: { name: 'GUPTA KIRANA STORE', gstin: '09ABCDE1234F1Z5', address: 'Hazratganj, Lucknow' },
  party: { name: 'Rakesh Kumar', phone: '98765 43210', address: 'Aliganj, Lucknow', balance: 6259 },
  invoice: { number: 212, date: '13/10/2026', theme: 'none' },
  items: [
    { name: 'SUGAR 5KG', rate: 310, qty: 2, gst: 5, unit: 'PKT', purchase: 272, stock: 4 },
    { name: 'TATA SALT 1KG', rate: 28, qty: 6, gst: 5, unit: 'PKT', purchase: 24, stock: 8 }
  ],
  brand: { cta: false },
  shots: []
};

/* The collections side: a builder chasing 52 lakh. */
const CASHFLO = {
  ...SHOP,
  business: { name: 'SHREE BALAJI BUILDING MATERIALS' },
  party: { name: 'AGRAWAL CONSTRUCTIONS', balance: 1400000, overdueDays: 68, standby: 3 },
  cashflo: {
    parties: [
      { name: 'SHANTI INFRA PROJECTS', balance: 1150000, overdueDays: 94, standby: 3 },
      { name: 'M R BUILDCON', balance: 900000, overdueDays: 41, standby: 2 },
      { name: 'Deepak Hardware Stores', balance: 760000, overdueDays: 22, standby: 2 },
      { name: 'NAVEEN CEMENT AGENCY', balance: 620000, overdueDays: 0, standby: 0 },
      { name: 'Sunil Traders', balance: 370000, overdueDays: 9, standby: 1 }
    ]
  }
};

const MOMOS = {
  ...SHOP,
  business: { name: 'JHANVI MOMOS CORNER' },
  invoice: { number: 108, date: '13/10/2026', theme: 'none' },
  items: [{ name: 'VEG MOMOS PLATE', rate: 60, qty: 2, gst: 5, unit: 'PLATE', purchase: 26 }]
};

/* screen -> [fixture, the second to show it at, taps that get it there].
 * A state is reached by TAPPING, played past the ripple, rather than poked in
 * from outside: that way the gallery shows a state the renderer can actually
 * produce. */
const T = (target, at = 0.2) => ({ at, do: 'tap', target });

const SHOTS = {
  'home': [SHOP, 1],
  'create-bill': [SHOP, 1],
  'create-invoice': [SHOP, 3, [{ at: 0.4, do: 'addItem', index: 0 }, { at: 1.2, do: 'addItem', index: 1 }]],
  'invoice-created': [SHOP, 1],
  'theme-store': [{ ...SHOP, invoice: { ...SHOP.invoice, theme: 'diwali' } }, 1.8],
  'items': [SHOP, 2.2, [T('low-stock')]],
  'create-item': [SHOP, 2.2, [{ at: 0.3, do: 'type', target: 'item-name', text: 'KAJU 500GM' }, T('batching', 1.2)]],
  'parties': [SHOP, 1],
  'scan-bills': [SHOP, 1],
  'scan-camera': [SHOP, 1.2],
  'scan-reading': [SHOP, 1],
  'scan-done': [SHOP, 1],
  'create-purchase': [SHOP, 1],
  'share-sheet': [SHOP, 2, [T('contact-0')]],
  'wa-attach': [SHOP, 1],
  'wa-chat': [SHOP, 1],
  'sales-list': [MOMOS, 2, [T('change-range')]],
  'profit-loss': [MOMOS, 1],
  'mcf-dashboard': [CASHFLO, 1],
  'mcf-parties': [CASHFLO, 1],
  'mcf-party': [CASHFLO, 2.2, [T('pause-calls')]],
  'mcf-automations': [CASHFLO, 1],
  'mcf-tally': [CASHFLO, 2.6],
  'mcf-ai-call': [CASHFLO, 7.8],
  'mcf-ai-ringing': [CASHFLO, 0.5],
  'mcf-new-automation': [CASHFLO, 3.4, [T('lang-hinglish'), T('tone-legal', 1.4), T('turn-on', 2.6)]],
  'tally-receivables': [CASHFLO, 1],
  'mcf-desktop': [CASHFLO, 2.2, [T('setup-automation')]],
  'mbb-desktop-parties': [SHOP, 1],
  'mbb-desktop-items': [SHOP, 1],
  'mbb-desktop-create-invoice': [SHOP, 2.2, [T('upload')]],
  'mbb-desktop-invoice': [SHOP, 2.2, [T('record-payment')]],
  'mbb-desktop-purchase': [SHOP, 2.2, [T('upload')]]
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
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () =>
    r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

await mkdir(OUT, { recursive: true });
const { server, origin } = await serveRepo();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.setTime === 'function');

const made = [];
for (const name of Object.keys(catalogue())) {
  const [data, at, actions] = SHOTS[name] ?? [SHOP, 1];
  const recipe = { ...data, shots: [{ screen: name, duration: 14, actions: actions ?? [] }] };

  await page.evaluate(r => window.mount(r), recipe);
  await page.evaluate(() => window.stageReady);
  await page.evaluate(t => window.setTime(t), at);

  const file = `${name}.png`;
  await page.screenshot({ path: join(OUT, file), animations: 'disabled' });
  made.push({ name, file, device: deviceOf(SCREENS[name]) });
  process.stdout.write('.');
}

await browser.close();
await new Promise(r => server.close(r));
await writeFile(join(OUT, 'index.json'), JSON.stringify(made, null, 2));
console.log(`\n${made.length} screens -> out/gallery`);
