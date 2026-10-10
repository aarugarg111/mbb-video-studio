#!/usr/bin/env node
/* The render service, listening.
 *
 * Everything that decides anything lives in service.js; this file only moves
 * bytes between node:http and that. Run it with:
 *
 *   RENDER_TOKEN=... node worker/server.js
 *
 * It needs a machine with Chromium and ffmpeg on it. See worker/README.md.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createService, MAX_RECIPE_BYTES } from './service.js';
import { compile } from './compile.js';
import { renderFrames } from './render.js';
import { encode } from './encode.js';

const FPS = 30;
const PORT = Number(process.env.PORT) || 8787;

/* The real work: a scratch directory per job, frames into it, ffmpeg over
 * them, then the frames go. Only the mp4 is kept, and only for its hour. */
async function render(recipe, { name, onProgress }) {
  const dir = await mkdtemp(join(tmpdir(), 'mbb-render-'));
  const framesDir = join(dir, 'frames');
  const video = join(dir, (name || 'clip') + '.mp4');

  try {
    await mkdir(framesDir, { recursive: true });
    await renderFrames(recipe, framesDir, { fps: FPS, onProgress });
    await encode(framesDir, video, { fps: FPS });
    return { video };
  } finally {
    /* The frames are large and are only worth keeping when a render failed,
     * and a failed render has already thrown by here. */
    await rm(framesDir, { recursive: true, force: true });
  }
}

/* When a job expires, its scratch directory goes with it. Without this the
 * disk fills up one clip at a time and the service dies, days later, of
 * something that looks unrelated. */
const cleanup = job => {
  if (job.video) rm(dirname(job.video), { recursive: true, force: true }).catch(() => {});
};

const service = createService({
  render,
  compile,
  cleanup,
  token: process.env.RENDER_TOKEN
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      /* Checked as it arrives, not after: the point of a limit is to stop
       * reading, and service.js can only check what it has already been given. */
      if (size > MAX_RECIPE_BYTES * 2) {
        reject(new Error('too big'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve(null);
      try { resolve(JSON.parse(text)); } catch { reject(new Error('Expected JSON.')); }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;

  /* The studio is served from the Cloudflare Worker, which proxies to here, so
   * the browser never calls this directly and no CORS is needed. The headers
   * below are for a browser that reaches it anyway during setup. */
  const cors = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end();
    return;
  }

  let body = null;
  if (req.method === 'POST') {
    try {
      body = await readBody(req);
    } catch (err) {
      const message = err.message === 'too big' ? 'That recipe is too long to be a recipe.' : err.message;
      res.writeHead(err.message === 'too big' ? 413 : 400, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: message }));
      return;
    }
  }

  let out;
  try {
    out = await service.handle({ method: req.method, path, headers: req.headers, body });
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ error: 'The render service broke: ' + err.message }));
    return;
  }

  if (out.file) {
    /* Read first, head second. Writing the header before opening the file
     * means a missing file leaves a half-sent 200 that cannot be corrected -
     * the same mistake render-browser.mjs made, which killed whole renders. */
    let size;
    try {
      size = (await stat(out.file)).size;
    } catch {
      res.writeHead(410, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: 'That video has been cleared. Render it again.' }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': out.type,
      'Content-Length': size,
      'Content-Disposition': 'attachment',
      ...cors
    });
    createReadStream(out.file).pipe(res);
    return;
  }

  res.writeHead(out.status, { 'Content-Type': out.type, ...cors });
  res.end(JSON.stringify(out.body));
});

/* A long clip is several hundred frames and the whole render can run past two
 * minutes; node's default would cut the connection mid-job. The page polls
 * rather than holding a request open, so this only covers the upload itself. */
server.requestTimeout = 5 * 60 * 1000;
server.headersTimeout = 60 * 1000;

server.listen(PORT, () => {
  console.log(`Render service on :${PORT}` + (process.env.RENDER_TOKEN ? '' : ' (no RENDER_TOKEN set - anyone who can reach it can use it)'));
});

/* Hosts stop a container by asking first and insisting later. Finishing the
 * render in progress is better than leaving a job that reads as rendering
 * forever. */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log('Stopping once the current render finishes...');
    server.close(() => process.exit(0));
  });
}

export { service };
