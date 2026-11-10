import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cf/src/worker.js';
import { signSession, cookieHeader } from '../cf/src/auth.js';

const ENV = {
  TEAM_PASSWORD: 'let-me-in',
  SESSION_SECRET: 'session-secret',
  ASSETS: { fetch: async () => new Response('the studio page', { status: 200 }) }
};

/* Stands in for Google, and records what the worker sent it. */
function captureUpstream() {
  const seen = {};
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.url = String(url);
    seen.headers = init.headers;
    seen.body = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  return { seen, restore: () => { globalThis.fetch = real; } };
}

const post = (path, body, cookie) => new Request('https://studio.example' + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body)
});

async function signedInCookie() {
  return `mvs_session=${await signSession(ENV.SESSION_SECRET)}`;
}

test('the right password returns a session cookie', async () => {
  const res = await worker.fetch(post('/api/login', { password: 'let-me-in' }), ENV);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Set-Cookie'), /mvs_session=/);
});

test('a wrong password is refused and sets no cookie', async () => {
  const res = await worker.fetch(post('/api/login', { password: 'guess' }), ENV);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('Set-Cookie'), null);
});

test('a missing secret says so instead of looking like a wrong password', async () => {
  const res = await worker.fetch(post('/api/login', { password: 'let-me-in' }), { ...ENV, TEAM_PASSWORD: '' });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /TEAM_PASSWORD/);
});

test('an unknown api path is a 404, not the studio page', async () => {
  const res = await worker.fetch(post('/api/whatever', {}), ENV);
  assert.equal(res.status, 404);
});

test('everything outside /api/ is served as a static asset', async () => {
  const res = await worker.fetch(new Request('https://studio.example/'), ENV);
  assert.equal(await res.text(), 'the studio page');
});

test('session reports signed out without a cookie, and in with one', async () => {
  const out = await worker.fetch(new Request('https://studio.example/api/session'), ENV);
  assert.equal((await out.json()).signedIn, false);

  const inn = await worker.fetch(new Request('https://studio.example/api/session', {
    headers: { Cookie: await signedInCookie() }
  }), ENV);
  assert.equal((await inn.json()).signedIn, true);
});

test('a password stored with stray whitespace still lets the team in', async () => {
  /* wrangler secret put keeps whatever the terminal gives it, so a pasted
   * password can carry a newline nobody can see. */
  const env = { ...ENV, TEAM_PASSWORD: '  let-me-in\n' };
  const res = await worker.fetch(post('/api/login', { password: 'let-me-in' }), env);
  assert.equal(res.status, 200);
});

test('a password typed with stray whitespace still lets the team in', async () => {
  const res = await worker.fetch(post('/api/login', { password: ' let-me-in ' }), ENV);
  assert.equal(res.status, 200);
});

test('trimming does not let a different password through', async () => {
  const res = await worker.fetch(post('/api/login', { password: 'let-me-in-too' }), ENV);
  assert.equal(res.status, 401);
});

test('an empty password is refused even against an unset-looking secret', async () => {
  const res = await worker.fetch(post('/api/login', { password: '   ' }), { ...ENV, TEAM_PASSWORD: '   ' });
  assert.equal(res.status, 401, 'an all-whitespace password must never be a way in');
});

/* The Gemini route is the only AI route there is now. The Worker used to
 * proxy Anthropic as well - a model allow-list, a token ceiling and a
 * region-pinned Durable Object - and all of it went with the paid path,
 * along with the tests that covered it. */
const GEM_PATH = '/api/gemini/v1beta/models/gemini-3.5-flash-lite:generateContent';
const GEM_ENV = { ...ENV, GEMINI_API_KEY: 'AIza-the-real-one' };

test('gemini is refused without a session, like everything else', async () => {
  const cap = captureUpstream();
  try {
    const res = await worker.fetch(post(GEM_PATH, { contents: [] }), GEM_ENV);
    assert.equal(res.status, 401);
    assert.equal(cap.seen.url, undefined, 'an unauthenticated call must never reach Google');
  } finally { cap.restore(); }
});

test('the gemini key is added by the worker and never comes from the browser', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(post(GEM_PATH, { contents: [] }, await signedInCookie()), GEM_ENV);
    assert.equal(cap.seen.headers['x-goog-api-key'], GEM_ENV.GEMINI_API_KEY);
    assert.match(cap.seen.url, /^https:\/\/generativelanguage\.googleapis\.com\//);
  } finally { cap.restore(); }
});

/* The URL is BUILT from the matched model, never passed through, so nobody
 * holding the team password can point this at another endpoint. */
test('an unknown gemini model falls back rather than reaching Google', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(
      post('/api/gemini/v1beta/models/gemini-9-enormous:generateContent', {}, await signedInCookie()),
      GEM_ENV
    );
    assert.match(cap.seen.url, /gemini-3\.5-flash-lite:generateContent$/);
  } finally { cap.restore(); }
});

test('a worker with no gemini key says so, so the studio can fall back', async () => {
  const cap = captureUpstream();
  try {
    const res = await worker.fetch(post(GEM_PATH, {}, await signedInCookie()), ENV);
    assert.equal(res.status, 501);
    assert.match((await res.json()).error, /gemini-not-configured/);
    assert.equal(cap.seen.url, undefined, 'it must not call Google without a key');
  } finally { cap.restore(); }
});

/* A secret that exists but holds a space.
 *
 * `wrangler secret list` shows it exactly like a real key, so the only thing
 * that can tell them apart is what the Worker does with it. Untrimmed, the
 * blank went to Google and came back as Google's own refusal - which reads
 * like a key that is wrong rather than one that was never typed. */
test('a gemini key that is present but blank counts as missing', async () => {
  const cap = captureUpstream();
  try {
    for (const blank of ['', '   ', '\n', '\t ']) {
      const res = await worker.fetch(
        post(GEM_PATH, {}, await signedInCookie()),
        { ...GEM_ENV, GEMINI_API_KEY: blank }
      );
      assert.equal(res.status, 501, JSON.stringify(blank));
      assert.match((await res.json()).error, /gemini-not-configured/);
      assert.equal(cap.seen.url, undefined, 'a blank key must never reach Google');
    }
  } finally { cap.restore(); }
});

test('a real key is still passed on, trimmed of what a terminal added', async () => {
  const cap = captureUpstream();
  try {
    const res = await worker.fetch(
      post(GEM_PATH, {}, await signedInCookie()),
      { ...GEM_ENV, GEMINI_API_KEY: '  AIzaREAL\n' }
    );
    assert.notEqual(res.status, 501);
    assert.equal(cap.seen.headers['x-goog-api-key'], 'AIzaREAL');
  } finally { cap.restore(); }
});
