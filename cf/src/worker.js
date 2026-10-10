import { signSession, verifySession, cookieHeader, clearCookie, readCookie, sameSecret } from './auth.js';

/* The studio holds no key of its own. The browser builds the whole Anthropic
 * request - prompt, schema, everything - and posts it here; this Worker checks
 * the session and adds the key on the way out. Nothing about the prompt lives
 * in this file, so there is no second copy of it to drift out of step with the
 * one the studio actually uses. */

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

/* Pinned here rather than trusted from the browser. Whoever has the team
 * password can reach this endpoint, and without these two lines they could
 * also point it at any model and any length - on Aryan's bill. */
const ALLOWED_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16000;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
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

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01'
  };
  /* The structured-output helper the studio uses asks for a beta; forward
   * whichever one the SDK asked for rather than pinning a version here. */
  const beta = request.headers.get('anthropic-beta');
  if (beta) headers['anthropic-beta'] = beta;

  const upstream = await fetch(UPSTREAM, { method: 'POST', headers, body: JSON.stringify(body) });

  /* Passed through as-is: the SDK reads Anthropic's own error shapes and says
   * something useful about them, which a reworded message would lose. */
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' }
  });
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
        return json({ signedIn: await verifySession(readCookie(request), env.SESSION_SECRET) });
      }
      if (pathname === '/api/anthropic/v1/messages') return proxy(request, env);
      return json({ error: 'No such endpoint.' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
