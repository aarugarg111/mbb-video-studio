import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cf/src/worker.js';
import { signSession, cookieHeader } from '../cf/src/auth.js';

const ENV = {
  ANTHROPIC_API_KEY: 'sk-ant-the-real-one',
  TEAM_PASSWORD: 'let-me-in',
  SESSION_SECRET: 'session-secret',
  ASSETS: { fetch: async () => new Response('the studio page', { status: 200 }) }
};

/* Stands in for api.anthropic.com and records what the worker sent it. */
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

test('the proxy refuses a request with no session', async () => {
  const cap = captureUpstream();
  try {
    const res = await worker.fetch(post('/api/anthropic/v1/messages', { model: 'x' }), ENV);
    assert.equal(res.status, 401);
    assert.equal(cap.seen.url, undefined, 'an unauthenticated call must never reach Anthropic');
  } finally { cap.restore(); }
});

test('the api key is added by the worker and never comes from the browser', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(
      post('/api/anthropic/v1/messages', { model: 'claude-opus-5-5', max_tokens: 100 }, await signedInCookie()),
      ENV
    );
    assert.equal(cap.seen.headers['x-api-key'], ENV.ANTHROPIC_API_KEY);
    assert.equal(cap.seen.url, 'https://api.anthropic.com/v1/messages');
  } finally { cap.restore(); }
});

test('the model is pinned, whatever the browser asks for', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(
      post('/api/anthropic/v1/messages', { model: 'something-expensive' }, await signedInCookie()),
      ENV
    );
    assert.equal(cap.seen.body.model, 'claude-opus-5-5');
  } finally { cap.restore(); }
});

test('max_tokens is capped, whatever the browser asks for', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(
      post('/api/anthropic/v1/messages', { max_tokens: 900000 }, await signedInCookie()),
      ENV
    );
    assert.equal(cap.seen.body.max_tokens, 16000);
  } finally { cap.restore(); }
});

test('a smaller max_tokens is left alone', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(
      post('/api/anthropic/v1/messages', { max_tokens: 500 }, await signedInCookie()),
      ENV
    );
    assert.equal(cap.seen.body.max_tokens, 500);
  } finally { cap.restore(); }
});

test('streaming is stripped', async () => {
  const cap = captureUpstream();
  try {
    await worker.fetch(
      post('/api/anthropic/v1/messages', { stream: true }, await signedInCookie()),
      ENV
    );
    assert.equal('stream' in cap.seen.body, false);
  } finally { cap.restore(); }
});

test('a missing secret says so instead of looking like a wrong password', async () => {
  const res = await worker.fetch(post('/api/login', { password: 'let-me-in' }), { ...ENV, ANTHROPIC_API_KEY: '' });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /ANTHROPIC_API_KEY/);
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
