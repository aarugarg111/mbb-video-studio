import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cf/src/worker.js';
import { Egress, REGIONS, blockedBeforeAnthropic } from '../cf/src/egress.js';
import { signSession, cookieHeader } from '../cf/src/auth.js';

/* Calling Anthropic from somewhere Anthropic answers.
 *
 * A Worker calls out from whichever data centre it happened to run in, and
 * Anthropic refuses whole regions at its own edge - before the key is looked
 * at, so it reads exactly like the key being turned off. It broke the studio
 * for one teammate at a time while working perfectly for everyone else.
 *
 * The misleading part, which is why this file says it out loud: the people it
 * happened to were in Bangalore. India is served. Cloudflare routes by
 * peering rather than geography and a lot of Indian traffic goes through Hong
 * Kong, so the person was in a supported country and the request was not.
 */

const SECRET = 'session-secret';

const env = (extra = {}) => ({
  ANTHROPIC_API_KEY: 'sk-ant-the-real-one',
  TEAM_PASSWORD: 'let-me-in',
  SESSION_SECRET: SECRET,
  ASSETS: { fetch: async () => new Response('the studio page') },
  ...extra
});

/* A refusal from the network in front of Anthropic: a ray, and no request id.
 * This is the shape the teammate's report carried. */
const regionRefusal = () => new Response(
  JSON.stringify({ error: { type: 'forbidden', message: 'Request not allowed' } }),
  { status: 403, headers: { 'Content-Type': 'application/json', 'cf-ray': 'a508-HKG' } }
);

/* A refusal from Anthropic itself. It has a request id, because the API
 * answered it. */
const realRefusal = () => new Response(
  JSON.stringify({ error: { type: 'permission_error', message: 'Not allowed to use that model' } }),
  { status: 403, headers: { 'Content-Type': 'application/json', 'request-id': 'req_123' } }
);

const ok = () => new Response(JSON.stringify({ ok: true }), {
  status: 200, headers: { 'Content-Type': 'application/json', 'request-id': 'req_ok' }
});

/* Stands in for the Durable Object namespace. Records which regions were
 * asked for, and answers per region. */
function fakeEgress(answers) {
  const asked = [];
  return {
    asked,
    idFromName: name => ({ name }),
    get: (id, options) => {
      asked.push({ name: id.name, hint: options?.locationHint });
      return {
        fetch: async () => {
          const answer = answers[options?.locationHint];
          if (typeof answer === 'function') return answer();
          if (answer instanceof Error) throw answer;
          return ok();
        }
      };
    }
  };
}

async function callWith(egress) {
  const cookie = cookieHeader(await signSession(SECRET));
  return worker.fetch(new Request('https://studio.example/api/anthropic/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
  }), env({ EGRESS: egress }));
}

test('the call leaves from a region that is pinned, not from wherever the viewer is', async () => {
  const egress = fakeEgress({ enam: ok });
  const res = await callWith(egress);

  assert.equal(res.status, 200);
  assert.equal(egress.asked[0].hint, 'enam', 'no location was asked for');
  assert.equal(egress.asked[0].name, 'anthropic-enam',
    'the object is named after its region - two regions must not share one object');
  assert.equal(res.headers.get('x-mvs-egress'), 'enam',
    'the answer does not say where it was called from');
});

test('a region that is refused is tried somewhere else', async () => {
  /* The actual bug: one region refuses, and before this the studio simply
     stopped working for that person. */
  const egress = fakeEgress({ enam: regionRefusal, wnam: ok });
  const res = await callWith(egress);

  assert.equal(res.status, 200, 'the refusal was passed on instead of being worked around');
  assert.deepEqual(egress.asked.map(a => a.hint), ['enam', 'wnam']);
  assert.equal(res.headers.get('x-mvs-egress'), 'wnam');
});

test('a refusal Anthropic itself issued is not retried anywhere', async () => {
  /* Anthropic gives every answer a request id, its refusals included. A 403
     carrying one was decided by the API and would be decided the same way
     from anywhere - retrying it spends another region's time saying so. */
  const egress = fakeEgress({ enam: realRefusal, wnam: ok });
  const res = await callWith(egress);

  assert.equal(res.status, 403, 'a genuine refusal was swapped for somebody else\'s success');
  assert.deepEqual(egress.asked.map(a => a.hint), ['enam'], 'it went looking for a kinder region');
  assert.equal(res.headers.get('x-mvs-request-id'), 'req_123');
});

test('when every region refuses, the last refusal is reported as it stands', async () => {
  const egress = fakeEgress({ enam: regionRefusal, wnam: regionRefusal });
  const res = await callWith(egress);

  assert.equal(res.status, 403);
  assert.deepEqual(egress.asked.map(a => a.hint), REGIONS);
  /* The ray survives, because it is the thing that says which edge refused. */
  assert.equal(res.headers.get('x-mvs-cf-ray'), 'a508-HKG');
  assert.equal(res.headers.get('x-mvs-egress'), 'wnam');
});

test('a region that cannot be reached at all is tried past, not fatal', async () => {
  const egress = fakeEgress({ enam: new Error('no route'), wnam: ok });
  const res = await callWith(egress);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-mvs-egress'), 'wnam');
});

test('every region failing says what happened rather than throwing', async () => {
  const egress = fakeEgress({ enam: new Error('no route'), wnam: new Error('no route') });
  const res = await callWith(egress);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error.message, /could not reach Anthropic/);
});

test('a studio with no object behind it works exactly as it used to', async () => {
  /* The fallback is the OLD behaviour, not a broken one: a deploy that has
     not had the migration applied must keep working for everyone it already
     worked for. */
  const real = globalThis.fetch;
  const seen = {};
  globalThis.fetch = async (url, init) => {
    seen.url = String(url);
    seen.key = init.headers['x-api-key'];
    return ok();
  };
  try {
    const cookie = cookieHeader(await signSession(SECRET));
    const res = await worker.fetch(new Request('https://studio.example/api/anthropic/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ messages: [] })
    }), env());
    assert.equal(res.status, 200);
    assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(seen.key, 'sk-ant-the-real-one');
    assert.equal(res.headers.get('x-mvs-egress'), null, 'it claimed a region it never pinned');
  } finally {
    globalThis.fetch = real;
  }
});

test('the object adds the key itself, and never takes one from the caller', async () => {
  /* The key belongs to the thing that talks to Anthropic. One place that
     knows it is easier to keep right than two. */
  const real = globalThis.fetch;
  const seen = {};
  globalThis.fetch = async (url, init) => {
    seen.url = String(url);
    seen.headers = init.headers;
    seen.body = JSON.parse(init.body);
    return ok();
  };
  try {
    const object = new Egress({}, { ANTHROPIC_API_KEY: '  sk-ant-padded\n' });
    const res = await object.fetch(new Request('https://egress.invalid/call', {
      method: 'POST',
      body: JSON.stringify({
        body: { messages: [{ role: 'user', content: 'hi' }] },
        version: '2023-06-01',
        beta: 'structured-outputs-2024-01-01'
      })
    }));

    assert.equal(res.status, 200);
    assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(seen.headers['x-api-key'], 'sk-ant-padded',
      'a key stored with stray whitespace is sent with it');
    assert.equal(seen.headers['anthropic-beta'], 'structured-outputs-2024-01-01');
    assert.deepEqual(seen.body.messages, [{ role: 'user', content: 'hi' }]);
  } finally {
    globalThis.fetch = real;
  }
});

test('which refusals are worth trying elsewhere', () => {
  assert.equal(blockedBeforeAnthropic(regionRefusal()), true);
  assert.equal(blockedBeforeAnthropic(realRefusal()), false, 'the API answered this one');
  assert.equal(blockedBeforeAnthropic(ok()), false);
  assert.equal(
    blockedBeforeAnthropic(new Response('{}', { status: 401 })), false,
    'a bad key is a bad key in every region'
  );
  assert.equal(
    blockedBeforeAnthropic(new Response('{}', { status: 429 })), false,
    'a rate limit is the account, not the place'
  );
});

test('the regions tried are places Anthropic serves', () => {
  /* Trying a refused region twice would be a slower way of failing. These are
     both in the United States, which is also where the API is. */
  assert.deepEqual(REGIONS, ['enam', 'wnam']);
  assert.ok(REGIONS.length > 1, 'one region is a single point of failure, which is the bug');
  assert.equal(new Set(REGIONS).size, REGIONS.length, 'the same region twice');
});
