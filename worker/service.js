/* The render service: recipe in, mp4 out, over HTTP.
 *
 * Why this exists: the studio renders in the browser using WebCodecs, which
 * Safari does not implement and no phone browser does usefully. On a phone the
 * tool gets as far as a shot list and then stops. This service does the same
 * render the command line does - headless Chrome plus ffmpeg - on a machine
 * that has both, so the page only has to ask and wait.
 *
 * The routing lives in `handle`, which takes and returns plain values. That is
 * what lets the whole surface be tested without launching a browser: the
 * rendering itself arrives as a function.
 */

import { randomUUID } from 'node:crypto';
import { createQueue } from './jobs.js';
import { sameSecret } from '../src/secret.js';

export const MAX_RECIPE_BYTES = 64 * 1024;

const json = (status, body) => ({ status, body, type: 'application/json; charset=utf-8' });

/* Checked in constant time, and only ever compared whole: this token is what
 * stops a stranger spending the machine's CPU. */
function authorised(headers, token) {
  if (!token) return true;
  const given = String(headers?.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!given) return false;
  return sameSecret(given, String(token).trim());
}

export function createService({ render, token, compile, queue, cleanup } = {}) {
  if (typeof render !== 'function') throw new Error('createService needs a render function.');
  if (typeof compile !== 'function') throw new Error('createService needs a compile function.');

  const jobs = queue ?? createQueue({
    run: (job, onProgress) => render(job.recipe, { name: job.name, onProgress })
  });

  async function start(body) {
    /* A recipe is a few kilobytes of YAML. Reading an unbounded body would let
     * one request swallow the machine's memory before anything checks it. */
    const text = String(body?.recipe ?? '');
    if (!text.trim()) return json(400, { error: 'No recipe was sent.' });
    if (Buffer.byteLength(text, 'utf8') > MAX_RECIPE_BYTES) {
      return json(413, { error: 'That recipe is too long to be a recipe.' });
    }

    let result;
    try {
      result = await compile(text);
    } catch (err) {
      return json(400, { error: 'That recipe could not be read: ' + (err?.message || String(err)) });
    }

    /* Refused here rather than at render time, so the reply names what is
     * wrong while the person is still looking at the page. */
    if (result.errors) {
      return json(400, { error: 'This recipe cannot be rendered.', problems: result.errors });
    }

    try {
      const job = jobs.submit({
        recipe: result.recipe,
        name: result.recipe.video || randomUUID(),
        /* Handed in rather than known here: what there is to delete depends on
         * where the render put it, which is the caller's business. */
        cleanup
      });
      return json(202, { ...job, warnings: result.warnings });
    } catch (err) {
      /* The queue is full - a real answer, and a temporary one. */
      return json(503, { error: err.message });
    }
  }

  async function handle({ method = 'GET', path = '/', headers = {}, body = null } = {}) {
    if (path === '/health') {
      return json(200, { ok: true, busy: jobs.busy, jobs: jobs.size });
    }

    if (!authorised(headers, token)) {
      return json(401, { error: 'This render service is not open to the public.' });
    }

    if (path === '/render' && method === 'POST') return start(body);

    const match = /^\/render\/([A-Za-z0-9]+)(\/video)?$/.exec(path);
    if (match) {
      if (method !== 'GET') return json(405, { error: 'Use GET.' });
      const [, id, wantsVideo] = match;
      const status = jobs.status(id);
      /* An expired job and a made-up one read the same, deliberately: the
       * reply says what to do about it either way. */
      if (!status) {
        return json(404, { error: 'No such video. It may have been cleared - render it again.' });
      }
      if (!wantsVideo) return json(200, status);

      if (status.state === 'failed') return json(500, { error: status.error });
      if (status.state !== 'done') return json(409, { error: 'That video is not finished yet.', state: status.state });
      return { status: 200, file: jobs.find(id).video, type: 'video/mp4' };
    }

    return json(404, { error: 'No such endpoint.' });
  }

  return { handle, jobs };
}
