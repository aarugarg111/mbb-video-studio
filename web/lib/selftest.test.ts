import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSelfTest, asReport } from './selftest';

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

/* The studio stamps everything it answers. */
const FROM_WORKER = { 'x-mvs-stage': 'worker', 'Content-Type': 'application/json' };

function stub(handlers: Record<string, () => Response>) {
  return (async (url: string | URL | Request) => {
    const key = String(url);
    const handler = handlers[key];
    if (!handler) throw new Error('unexpected request: ' + key);
    return handler();
  }) as unknown as typeof fetch;
}

const find = (steps: Awaited<ReturnType<typeof runSelfTest>>, name: string) =>
  steps.find(s => s.name === name)!;

test('a working studio passes every step', async () => {
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: true, canRender: false }, FROM_WORKER),
    '/api/anthropic/v1/messages': () => reply(200, { content: [] }, { ...FROM_WORKER, 'x-mvs-stage': 'anthropic', 'x-mvs-request-id': 'req_1' })
  }));
  assert.deepEqual(steps.map(s => s.outcome), ['ok', 'ok', 'ok']);
});

test('a reply that did not come from the studio is named as such', async () => {
  /* The decisive case: something between this machine and the studio answered
     instead - a company proxy or a security filter. The absence of the
     studio's own stamp is the finding. */
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(403, { error: { type: 'forbidden', message: 'Request not allowed' } },
      { 'Content-Type': 'application/json' })
  }));

  const first = find(steps, 'Reaching the studio');
  assert.equal(first.outcome, 'failed');
  assert.match(first.detail, /did not come from the studio/);
  assert.match(first.detail, /proxy or a security filter/);
});

test('a studio that cannot be reached at all blames the network, not the key', async () => {
  const steps = await runSelfTest((async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
  assert.equal(find(steps, 'Reaching the studio').outcome, 'failed');
  assert.match(find(steps, 'Reaching the studio').detail, /this network or something on it/i);
  /* Nothing further can be concluded, so nothing further is claimed. */
  assert.equal(find(steps, 'Reaching Claude').outcome, 'skipped');
});

test('a dropped sign-in cookie is told apart from a refusal', async () => {
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: false }, FROM_WORKER)
  }));
  assert.equal(find(steps, 'Reaching the studio').outcome, 'ok');
  assert.equal(find(steps, 'Signed in').outcome, 'failed');
  assert.match(find(steps, 'Signed in').detail, /blocking the cookie/);
  assert.equal(find(steps, 'Reaching Claude').outcome, 'skipped');
});

test('a refusal that reached Claude is told apart from one that did not', async () => {
  const reachedClaude = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: true }, FROM_WORKER),
    '/api/anthropic/v1/messages': () => reply(403, { type: 'error', error: { type: 'permission_error', message: 'no' } },
      { 'x-mvs-stage': 'anthropic', 'x-mvs-request-id': 'req_9' })
  }));
  assert.match(find(reachedClaude, 'Reaching Claude').detail, /Claude itself refused this/);
  assert.match(find(reachedClaude, 'Reaching Claude').detail, /key, its credit/);

  const stoppedEarlier = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: true }, FROM_WORKER),
    '/api/anthropic/v1/messages': () => reply(403, { error: { type: 'forbidden', message: 'Request not allowed' } },
      { 'x-mvs-stage': 'anthropic', 'x-mvs-cf-ray': '8f2a' })
  }));
  assert.match(find(stoppedEarlier, 'Reaching Claude').detail, /never reached Claude/);
  assert.ok(!find(stoppedEarlier, 'Reaching Claude').detail.includes('its credit'));
});

test('the refusal text itself is carried, not summarised away', async () => {
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: true }, FROM_WORKER),
    '/api/anthropic/v1/messages': () => reply(403, '{"error":{"type":"forbidden","message":"Request not allowed"}}',
      { 'x-mvs-stage': 'anthropic' })
  }));
  assert.match(find(steps, 'Reaching Claude').detail, /Request not allowed/);
});

test('a request cut off mid-flight points at the network', async () => {
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: true }, FROM_WORKER),
    '/api/anthropic/v1/messages': () => { throw new TypeError('Load failed'); }
  }));
  assert.match(find(steps, 'Reaching Claude').detail, /proxy or\s+filter/);
});

test('the report is one block, ready to paste', async () => {
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(200, { signedIn: true }, FROM_WORKER),
    '/api/anthropic/v1/messages': () => reply(200, {}, { 'x-mvs-stage': 'anthropic' })
  }));
  const report = asReport(steps);
  assert.match(report, /connection check/);
  assert.match(report, /OK {2}Reaching the studio/);
  for (const step of steps) assert.ok(report.includes(step.name), step.name);
});

test('every step always reports an outcome, whatever happened', async () => {
  const steps = await runSelfTest(stub({
    '/api/session': () => reply(500, 'upstream exploded', FROM_WORKER)
  }));
  assert.equal(steps.length, 3, 'a check that stops early still says what it did not check');
  for (const s of steps) assert.ok(['ok', 'failed', 'skipped'].includes(s.outcome), s.name);
});
