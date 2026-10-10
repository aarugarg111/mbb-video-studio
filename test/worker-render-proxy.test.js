import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cf/src/worker.js';
import { signSession, cookieHeader } from '../cf/src/auth.js';

const SECRETS = {
  ANTHROPIC_API_KEY: 'sk-ant-test',
  TEAM_PASSWORD: 'open sesame',
  SESSION_SECRET: 'a-signing-secret'
};

const env = (extra = {}) => ({ ...SECRETS, ASSETS: { fetch: () => new Response('page') }, ...extra });

async function signedIn() {
  return cookieHeader(await signSession(SECRETS.SESSION_SECRET));
}

/* Records what the Worker asked the render machine for, and answers however
 * the test wants. */
function spy(reply = () => new Response(JSON.stringify({ id: 'job1' }), { status: 202 })) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply(String(url), init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function request(path, { method = 'GET', cookie, body } = {}) {
  return new Request('https://studio.example' + path, {
    method,
    headers: cookie ? { Cookie: cookie.split(';')[0] } : {},
    body
  });
}

test('a signed-in render request reaches the render machine with the token attached', async () => {
  const s = spy();
  try {
    const res = await worker.fetch(
      request('/api/render', { method: 'POST', cookie: await signedIn(), body: JSON.stringify({ recipe: 'x' }) }),
      env({ RENDER_URL: 'https://render.example', RENDER_TOKEN: 'the-token' })
    );
    assert.equal(res.status, 202);
    assert.equal(s.calls.length, 1);
    assert.equal(s.calls[0].url, 'https://render.example/render');
    assert.equal(s.calls[0].init.headers.Authorization, 'Bearer the-token');
  } finally {
    s.restore();
  }
});

test('the render token never comes back to the browser', async () => {
  const s = spy();
  try {
    const res = await worker.fetch(
      request('/api/render', { method: 'POST', cookie: await signedIn(), body: '{}' }),
      env({ RENDER_URL: 'https://render.example', RENDER_TOKEN: 'the-token' })
    );
    const text = await res.text();
    assert.ok(!text.includes('the-token'));
    for (const [, value] of res.headers) assert.ok(!String(value).includes('the-token'));
  } finally {
    s.restore();
  }
});

test('a token stored with a stray newline is trimmed before it is sent', async () => {
  const s = spy();
  try {
    await worker.fetch(
      request('/api/render', { method: 'POST', cookie: await signedIn(), body: '{}' }),
      env({ RENDER_URL: 'https://render.example/', RENDER_TOKEN: ' the-token\n' })
    );
    assert.equal(s.calls[0].init.headers.Authorization, 'Bearer the-token');
    assert.equal(s.calls[0].url, 'https://render.example/render', 'a trailing slash does not become a double one');
  } finally {
    s.restore();
  }
});

test('without a session nothing is forwarded', async () => {
  const s = spy();
  try {
    const res = await worker.fetch(
      request('/api/render', { method: 'POST', body: '{}' }),
      env({ RENDER_URL: 'https://render.example', RENDER_TOKEN: 'the-token' })
    );
    assert.equal(res.status, 401);
    assert.equal(s.calls.length, 0, 'an unauthenticated request must not reach the render machine at all');
  } finally {
    s.restore();
  }
});

test('with no render machine configured the reply says to use Chrome', async () => {
  const res = await worker.fetch(
    request('/api/render', { method: 'POST', cookie: await signedIn(), body: '{}' }),
    env()
  );
  assert.equal(res.status, 501);
  assert.match((await res.json()).error, /Chrome or Edge/);
});

test('a render machine that does not answer is reported as that, not as a broken studio', async () => {
  const s = spy(() => { throw new Error('connect ECONNREFUSED'); });
  try {
    const res = await worker.fetch(
      request('/api/render', { method: 'POST', cookie: await signedIn(), body: '{}' }),
      env({ RENDER_URL: 'https://render.example' })
    );
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /did not answer/);
  } finally {
    s.restore();
  }
});

test('a job status and the video itself both pass through', async () => {
  const s = spy(url => url.endsWith('/video')
    ? new Response('mp4 bytes', { status: 200, headers: { 'Content-Type': 'video/mp4' } })
    : new Response(JSON.stringify({ state: 'done' }), { status: 200 }));
  try {
    const cookie = await signedIn();
    const config = env({ RENDER_URL: 'https://render.example' });

    const status = await worker.fetch(request('/api/render/abc', { cookie }), config);
    assert.deepEqual(await status.json(), { state: 'done' });

    const video = await worker.fetch(request('/api/render/abc/video', { cookie }), config);
    assert.equal(video.headers.get('Content-Type'), 'video/mp4');
    assert.equal(await video.text(), 'mp4 bytes');

    assert.deepEqual(s.calls.map(c => c.url), [
      'https://render.example/render/abc',
      'https://render.example/render/abc/video'
    ]);
  } finally {
    s.restore();
  }
});

test('the session reply says whether a video can be rendered for you', async () => {
  const cookie = await signedIn();

  const without = await worker.fetch(request('/api/session', { cookie }), env());
  assert.equal((await without.json()).canRender, false);

  const with_ = await worker.fetch(request('/api/session', { cookie }), env({ RENDER_URL: 'https://render.example' }));
  const body = await with_.json();
  assert.equal(body.canRender, true);
  assert.equal(body.signedIn, true);
});

test('a render path cannot be bent into some other address', async () => {
  const s = spy();
  try {
    const cookie = await signedIn();
    const config = env({ RENDER_URL: 'https://render.example' });

    /* The path is appended to RENDER_URL, so what matters is that it stays
     * under it - the render service refuses anything that is not a job id,
     * and nothing here can point the Worker at a different host. */
    await worker.fetch(request('/api/render/../../admin', { cookie }), config);
    for (const call of s.calls) {
      assert.ok(call.url.startsWith('https://render.example/render'), call.url);
    }
  } finally {
    s.restore();
  }
});
