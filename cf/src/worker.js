import { signSession, verifySession, cookieHeader, clearCookie, readCookie, sameSecret } from './auth.js';

/* The studio holds no key of its own. The browser builds the whole request -
 * prompt and all - and posts it here; this Worker checks the session and adds
 * the key on the way out. Nothing about the prompt lives in this file, so
 * there is no second copy of it to drift out of step with the one the studio
 * actually uses.
 *
 * It used to proxy Anthropic as well, and most of this file was that: a
 * model allow-list, a token ceiling, and a Durable Object that pinned the
 * egress region because Anthropic refused whole regions at its own edge and
 * broke the studio for one teammate at a time. All of it is gone with the
 * paid path. The studio reads scripts on Gemini's free tier and nothing
 * else, so a live endpoint that could still spend money - reachable by
 * anyone holding the team password, called by nothing - had no business
 * being left here.
 *
 * The region fix went with it. If Google ever refuses a region the same way,
 * cf/src/egress.js is in the history and the reasoning is written down
 * there; it is not carried around on the chance that it might be. */

/* Chrome and Edge on a computer can make the video themselves, using
 * WebCodecs. Safari cannot, and no phone browser can usefully, so on those the
 * studio stops at a shot list. RENDER_URL points at a machine that renders the
 * same clip the command line does; this Worker is the only thing that knows
 * its token, exactly as it is the only thing that knows the API key. */
const RENDER_TIMEOUT_MS = 120000;


const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-mvs-stage': 'worker', ...headers }
  });

function missing(env) {
  /* GEMINI_API_KEY is not here: without it the studio cannot read a script,
     but the Worker itself still serves the page and signs people in, and the
     gemini route says plainly what is wrong. A startup check that refused to
     boot would turn a clear message into a blank screen. */
  return ['TEAM_PASSWORD', 'SESSION_SECRET'].filter(k => !env[k]);
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

/* The same arrangement as the Anthropic proxy, for Google: the browser builds
 * the whole request and this adds the key.
 *
 * It exists because team mode had no way to reach the free provider at all.
 * The studio on Pages has let people bring a Gemini key for a while - it has
 * a free tier, and the studio's entire running cost is this one call - but
 * the team build routed everything to Anthropic, so the one deployment the
 * team actually uses was the one that had to pay.
 *
 * Without GEMINI_API_KEY set this answers 501 and says so plainly, rather
 * than calling Google without a key and passing on whatever Google says
 * about that. The studio reads the 501 and falls back to Claude, so a Worker
 * deployed without the secret keeps working and merely costs money. */
const GEMINI_MODELS = new Set(['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash']);
const GEMINI_DEFAULT = 'gemini-3.5-flash-lite';

async function geminiProxy(request, env, pathname) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!await verifySession(readCookie(request), env.SESSION_SECRET)) {
    return json({ error: 'Your session has expired. Sign in again.' }, 401);
  }
  /* Trimmed, so a secret that exists but holds nothing but a space counts
   * as missing. `wrangler secret put` keeps whatever the terminal hands it,
   * and a secret that is present-but-blank LISTS exactly like a real one -
   * so the only thing that tells them apart is what the Worker does with it.
   * Untrimmed, a blank key went to Google and came back as its own confusing
   * refusal instead of the plain sentence below. */
  const key = String(env.GEMINI_API_KEY ?? '').trim();
  if (!key) {
    return json({ error: 'gemini-not-configured', detail: 'This Worker has no GEMINI_API_KEY set.' }, 501);
  }

  /* Only generateContent, and only on a model from the list. The path is
   * built here from the matched model rather than passed through, so nothing
   * from the browser reaches Google's URL - a password-holder cannot point
   * this at another endpoint or another project's model. */
  const asked = decodeURIComponent(
    pathname.match(/^\/api\/gemini\/v1beta\/models\/([^:]+):generateContent$/)?.[1] ?? ''
  );
  if (!asked) return json({ error: 'Only generateContent is proxied.' }, 404);
  const model = GEMINI_MODELS.has(asked) ? asked : GEMINI_DEFAULT;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Expected JSON.' }, 400); }
  delete body.stream;

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    }
  );

  /* Passed through as-is, for the same reason the Anthropic one is: the page
   * already knows how to read Google's error shapes, and the retry that
   * drops the thinking setting depends on seeing Google's own words. */
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'x-mvs-stage': 'gemini'
    }
  });
}


export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      /* A missing secret otherwise shows up as a 401 on a correct password
       * and sends whoever set it up looking in the wrong place. */
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
      if (pathname.startsWith('/api/gemini/')) return geminiProxy(request, env, pathname);
      if (pathname.startsWith('/api/render')) return renderProxy(request, env, pathname);
      return json({ error: 'No such endpoint.' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
