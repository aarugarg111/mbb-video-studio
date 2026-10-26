import { signSession, verifySession, cookieHeader, clearCookie, readCookie, sameSecret } from './auth.js';
import { REGIONS, blockedBeforeAnthropic } from './egress.js';

/* The Durable Object the call to Anthropic is made from. Cloudflare needs it
 * exported from the Worker's entry point, not only defined. */
export { Egress } from './egress.js';

/* The studio holds no key of its own. The browser builds the whole Anthropic
 * request - prompt, schema, everything - and posts it here; this Worker checks
 * the session and adds the key on the way out. Nothing about the prompt lives
 * in this file, so there is no second copy of it to drift out of step with the
 * one the studio actually uses. */

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

/* Chrome and Edge on a computer can make the video themselves, using
 * WebCodecs. Safari cannot, and no phone browser can usefully, so on those the
 * studio stops at a shot list. RENDER_URL points at a machine that renders the
 * same clip the command line does; this Worker is the only thing that knows
 * its token, exactly as it is the only thing that knows the API key. */
const RENDER_TIMEOUT_MS = 120000;

/* Pinned here rather than trusted from the browser. Whoever has the team
 * password can reach this endpoint, and without these two lines they could
 * also point it at any model and any length - on Aryan's bill. */
const ALLOWED_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16000;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-mvs-stage': 'worker', ...headers }
  });

function missing(env) {
  return ['ANTHROPIC_API_KEY', 'TEAM_PASSWORD', 'SESSION_SECRET'].filter(k => !env[k]);
}

async function login(request, env) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Expected JSON.' }, 400); }
  /* Trimmed on both sides. `wrangler secret put` keeps whatever the terminal
   * hands it, so a pasted password can carry a trailing newline or a stray
   * space that nobody can see and that makes every correct attempt fail -
   * which is exactly how this first went wrong. Nobody means a password to
   * begin or end with a space. */
  const given = String(body?.password ?? '').trim();
  const expected = String(env.TEAM_PASSWORD).trim();
  /* Without this, trimming turns an all-whitespace secret into an empty one
   * that an all-whitespace guess matches - the door left open by the fix for
   * the door being stuck. A test caught it. */
  if (!given || !expected) return json({ error: 'That password is not right.' }, 401);
  if (!sameSecret(given, expected)) {
    return json({ error: 'That password is not right.' }, 401);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(await signSession(env.SESSION_SECRET)) });
}

/* Forwards /api/render/* to the render service, unchanged apart from the
 * token. Streaming the body straight through means an mp4 of any size costs
 * this Worker nothing to carry. */
async function renderProxy(request, env, pathname) {
  if (!env.RENDER_URL) {
    return json({ error: 'This studio has no render service, so the video has to be made in the browser. Chrome or Edge on a computer can do it.' }, 501);
  }
  if (!await verifySession(readCookie(request), env.SESSION_SECRET)) {
    return json({ error: 'Your session has expired. Sign in again.' }, 401);
  }

  const target = String(env.RENDER_URL).trim().replace(/\/$/, '') + pathname.replace('/api/render', '/render');
  const headers = { 'Content-Type': 'application/json' };
  if (env.RENDER_TOKEN) headers.Authorization = 'Bearer ' + String(env.RENDER_TOKEN).trim();

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS)
    });
  } catch (err) {
    /* A render machine that is asleep, restarting or simply gone. Saying so is
     * better than a browser error that reads like the studio is broken. */
    return json({ error: 'The render machine did not answer. It may be starting up - try again in a minute.' }, 502);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      ...(upstream.headers.get('Content-Length') ? { 'Content-Length': upstream.headers.get('Content-Length') } : {})
    }
  });
}

async function proxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!await verifySession(readCookie(request), env.SESSION_SECRET)) {
    return json({ error: 'Your session has expired. Sign in again.' }, 401);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Expected JSON.' }, 400); }

  body.model = ALLOWED_MODEL;
  body.max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS);
  /* Streaming would have to be piped back verbatim; the studio does not use it
   * and allowing it here would only add a path nothing exercises. */
  delete body.stream;

  /* The structured-output helper the studio uses asks for a beta; forward
   * whichever one the SDK asked for rather than pinning a version here. */
  const payload = {
    body,
    version: request.headers.get('anthropic-version') || '2023-06-01',
    beta: request.headers.get('anthropic-beta') || null
  };

  const { upstream, region } = await askAnthropic(env, payload);

  /* Passed through as-is: the SDK reads Anthropic's own error shapes and says
   * something useful about them, which a reworded message would lose. The
   * headers are added so that a refusal can be traced to whoever issued it -
   * this Worker, Cloudflare in front of it, or Anthropic behind it. They look
   * identical on the screen and are fixed in three different places. */
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'x-mvs-stage': 'anthropic',
      /* Where the call left from - the whole point of the fix below, and the
       * one thing an error report could not say before. A refusal naming no
       * region came from a studio that never pinned one. */
      ...(region ? { 'x-mvs-egress': region } : {}),
      /* Cloudflare's own reference. A refusal from an edge rather than from
       * Anthropic's API carries a ray and no request id - which is exactly
       * the difference worth knowing. */
      ...(upstream.headers.get('cf-ray') ? { 'x-mvs-cf-ray': upstream.headers.get('cf-ray') } : {}),
      ...(upstream.headers.get('request-id') ? { 'x-mvs-request-id': upstream.headers.get('request-id') } : {})
    }
  });
}

/* Anthropic, called from somewhere Anthropic answers.
 *
 * A Worker calls out from whichever data centre it happened to run in, and
 * Anthropic refuses whole regions at its own edge - so the studio broke for
 * one teammate at a time while working perfectly for everybody else. The call
 * is made from a Durable Object pinned to a region instead. cf/src/egress.js
 * has the why, including why smart placement was not enough.
 *
 * Without the binding this falls back to calling Anthropic directly, which is
 * what the tests do and what a studio deployed before this did. That studio
 * then behaves exactly as it used to, which is the point: the fallback is the
 * old behaviour rather than a broken one.
 */
async function askAnthropic(env, payload) {
  if (!env.EGRESS) return { upstream: await callDirect(env, payload), region: null };

  let last = null;
  for (const region of REGIONS) {
    /* One object per region, named after it. A location hint only applies
     * when an object is first created, so asking a second region means
     * asking a second object - the first one cannot be moved. */
    const stub = env.EGRESS.get(
      env.EGRESS.idFromName('anthropic-' + region), { locationHint: region }
    );

    let upstream;
    try {
      upstream = await stub.fetch('https://egress.invalid/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      /* A region that cannot be reached at all is worth trying past, but not
       * worth losing: if every one of them fails, say what happened. */
      last = {
        upstream: json({
          error: {
            type: 'api_error',
            message: `The studio could not reach Anthropic from ${region}: ${err.message}`
          }
        }, 502),
        region
      };
      continue;
    }

    if (!blockedBeforeAnthropic(upstream)) return { upstream, region };
    last = { upstream, region };
  }

  return last;
}

/* The old path, for a studio with no Durable Object behind it. */
async function callDirect(env, payload) {
  const headers = {
    'Content-Type': 'application/json',
    /* Trimmed for the reason the password is: `wrangler secret put` stores
     * whatever the terminal gave it, and a key with a trailing newline comes
     * back from Anthropic as "invalid x-api-key" - which reads like the wrong
     * key rather than the right one with a character stuck to it. */
    'x-api-key': String(env.ANTHROPIC_API_KEY).trim(),
    'anthropic-version': payload.version || '2023-06-01'
  };
  if (payload.beta) headers['anthropic-beta'] = payload.beta;
  return fetch(UPSTREAM, { method: 'POST', headers, body: JSON.stringify(payload.body) });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      /* A missing secret otherwise shows up as a 401 on a correct password, or
       * an Anthropic auth error, and sends whoever set it up looking in the
       * wrong place. */
      const gaps = missing(env);
      if (gaps.length) {
        return json({ error: `This studio is not finished being set up: ${gaps.join(', ')} ${gaps.length > 1 ? 'are' : 'is'} missing. See cf/DEPLOY.md.` }, 503);
      }

      if (pathname === '/api/login') return login(request, env);
      if (pathname === '/api/logout') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
      if (pathname === '/api/session') {
        return json({
          signedIn: await verifySession(readCookie(request), env.SESSION_SECRET),
          /* So the page knows whether it can offer to render for a browser
           * that cannot do it itself, rather than finding out by failing. */
          canRender: Boolean(env.RENDER_URL)
        });
      }
      if (pathname === '/api/anthropic/v1/messages') return proxy(request, env);
      if (pathname.startsWith('/api/render')) return renderProxy(request, env, pathname);
      return json({ error: 'No such endpoint.' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
