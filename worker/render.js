/* Drives the stage's clock and photographs each step.
 *
 * Deliberately NOT a screen recording: we set the time, wait for the page to
 * settle, then capture. Nothing is dropped, nothing is timing-dependent, and
 * the same recipe always produces the same frames.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { totalDuration } from '../src/timeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const WIDTH = 1080;
const HEIGHT = 1920;
const READY_TIMEOUT_MS = 10000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2'
};

/* The stage page loads native ES modules. Chrome gives a file:// page an opaque
 * origin and blocks module imports from it outright - the page comes up blank
 * with no window.setTime, and the only symptom is a timeout ten seconds later.
 * So the stage is served over HTTP. node:http is built in, so this costs no
 * dependency, and it matches how the stage gets served once this is hosted. */
function serveRepo() {
  const server = createServer(async (req, res) => {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[/\\]+/, '');
    const full = join(ROOT, rel);

    if (full !== ROOT && !full.startsWith(ROOT + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(full);
      res.writeHead(200, { 'Content-Type': TYPES[extname(full)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function openStage(recipe) {
  const { server, origin } = await serveRepo();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1
  });

  /* Throwing inside the handler would be swallowed, so record it and check
   * after each await instead. A broken screen module shows up here as a blank
   * video otherwise - worth the extra plumbing. */
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const throwIfBroken = () => {
    if (pageErrors.length > 0) throw new Error('Stage page error: ' + pageErrors[0]);
  };

  await page.goto(`${origin}/stage/index.html`, { waitUntil: 'load' });
  throwIfBroken();

  await page.waitForFunction(() => typeof window.setTime === 'function', null, { timeout: READY_TIMEOUT_MS });
  await page.evaluate(r => window.mount(r), recipe);
  await page.evaluate(() => window.stageReady);
  throwIfBroken();

  const fontErrors = await page.evaluate(() => window.fontErrors);
  if (fontErrors.length > 0) {
    console.warn('warning: font did not load, frames will use a fallback face: ' + fontErrors.join('; '));
  }

  /* Closing both is the caller's job - the server outlives the page. */
  const close = async () => {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  };

  return { browser, page, throwIfBroken, close };
}

export async function renderFrames(recipe, outDir, { fps = 30, onProgress } = {}) {
  const frames = Math.round(totalDuration(recipe) * fps);
  const { page, throwIfBroken, close } = await openStage(recipe);

  /* The total is reported before the first frame: a clip is several hundred
   * frames, and whoever is waiting should see how many from the start rather
   * than a bar that only becomes a bar once it is half done. */
  if (onProgress) onProgress(0, frames);

  try {
    for (let i = 0; i < frames; i++) {
      await page.evaluate(t => window.setTime(t), i / fps);
      await page.screenshot({
        path: join(outDir, `f${String(i).padStart(5, '0')}.png`),
        animations: 'disabled'
      });
      throwIfBroken();
      if (onProgress) onProgress(i + 1, frames);
    }
    return frames;
  } finally {
    await close();
  }
}

export async function renderStill(recipe, t, outPath) {
  const { page, throwIfBroken, close } = await openStage(recipe);
  try {
    await page.evaluate(time => window.setTime(time), t);
    await page.screenshot({ path: outPath, animations: 'disabled' });
    throwIfBroken();
  } finally {
    await close();
  }
}
