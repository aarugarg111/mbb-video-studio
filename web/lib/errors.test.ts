import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain } from './errors';

/* The one a teammate actually saw. */
const THE_403 = Object.assign(
  new Error('403 {"error":{"type":"forbidden","message":"Request not allowed"}}'),
  { status: 403 }
);

test('the 403 a teammate saw becomes a sentence, not an error envelope', () => {
  const { message, detail } = explain(THE_403, true);
  assert.ok(!message.includes('{'), 'no JSON reaches the screen');
  assert.match(message, /refused the request/);
  assert.match(message, /turned off|credit|model/);
  assert.ok(detail.includes('Request not allowed'), 'the raw text is kept for whoever has to fix it');
});

test('whose key it is changes the advice', () => {
  /* "Replace the key above" is wrong when the key lives in Cloudflare, and
     "send it to Aryan" is wrong when it is in your own browser. */
  assert.match(explain(THE_403, true).message, /send this to Aryan/i);
  assert.match(explain(THE_403, false).message, /saved in this browser/i);
});

test('a rejected key is told apart from a refused request', () => {
  const unauthorised = Object.assign(new Error('invalid x-api-key'), { status: 401 });
  assert.match(explain(unauthorised, true).message, /would not accept the key/);
  assert.ok(!explain(unauthorised, true).message.includes('refused the request outright'));
});

test('the ones worth simply retrying say so', () => {
  for (const [status, text] of [[429, 'rate_limit_error'], [529, 'overloaded_error'], [500, 'internal']] as const) {
    const { message } = explain(Object.assign(new Error(text), { status }), true);
    assert.match(message, /try again/i, String(status));
    assert.ok(!message.includes('Aryan'), `${status} is not a key problem`);
  }
});

test('a half-finished setup is named as such', () => {
  const err = new Error('This studio is not finished being set up: TEAM_PASSWORD is missing.');
  assert.match(explain(err, true).message, /not finished being set up/);
  assert.match(explain(err, true).message, /not anything you did/);
});

test('an expired session says what to do and that nothing is lost', () => {
  const err = Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 });
  const { message } = explain(err, true);
  assert.match(message, /sign in again/i);
  assert.match(message, /still be here/);
});

test('a dropped connection is not blamed on the key', () => {
  const { message } = explain(new TypeError('Failed to fetch'), true);
  assert.match(message, /could not be reached/);
  assert.ok(!message.includes('key'));
});

test('a status buried in the message is still found', () => {
  /* The SDK puts it at the front of the text rather than on a field. */
  const { message } = explain(new Error('429 Too Many Requests'), true);
  assert.match(message, /too much at once/);
});

test('something unrecognised is passed through rather than swallowed', () => {
  const { message, detail } = explain(new Error('something nobody anticipated'), true);
  assert.equal(message, 'something nobody anticipated');
  assert.equal(detail, 'something nobody anticipated');
});

test('it never throws, whatever it is handed', () => {
  for (const odd of [null, undefined, 42, { a: 1 }, 'plain string', Symbol('x')]) {
    assert.doesNotThrow(() => explain(odd, true), String(String(odd)));
    assert.equal(typeof explain(odd, true).message, 'string');
  }
});

test('the error carries who answered it, which is the whole diagnosis', () => {
  /* A 403 from the Worker, from Cloudflare, and from Claude look identical on
     screen and are fixed in three different places. Claude's API always
     returns a request id; an edge refusal in front of it returns a ray and no
     request id. That difference is the answer, so it has to reach the person
     reporting the fault. */
  const fromClaude = Object.assign(new Error('403 forbidden'), {
    status: 403,
    headers: new Headers({ 'x-mvs-stage': 'anthropic', 'x-mvs-request-id': 'req_abc123' })
  });
  assert.match(explain(fromClaude, true).detail, /answered by: anthropic/);
  assert.match(explain(fromClaude, true).detail, /claude request id: req_abc123/);

  const fromAnEdge = Object.assign(new Error('403 forbidden'), {
    status: 403,
    headers: new Headers({ 'x-mvs-stage': 'anthropic', 'x-mvs-cf-ray': '8f2a1b' })
  });
  const detail = explain(fromAnEdge, true).detail;
  assert.ok(!detail.includes('request id'), 'no request id means Claude never saw it');

  const fromTheWorker = Object.assign(new Error('403'), {
    status: 403,
    headers: new Headers({ 'x-mvs-stage': 'worker' })
  });
  assert.match(explain(fromTheWorker, true).detail, /answered by: worker/);
});

test('an error with no headers at all still explains itself', () => {
  assert.doesNotThrow(() => explain(new Error('403 forbidden'), true));
  assert.equal(explain(new Error('plain'), true).detail, 'plain');
});

test('headers given as a plain object are read too', () => {
  /* Not every SDK hands back a Headers instance. */
  const err = Object.assign(new Error('403'), { status: 403, headers: { 'x-mvs-stage': 'worker' } });
  assert.match(explain(err, true).detail, /answered by: worker/);
});

test('a 403 from the edge is not reported as a key problem', () => {
  /* The real one, from the first report: refused by Cloudflare in front of
     Anthropic, at their Hong Kong edge. It carries a ray and NO request id,
     which is how you know it never reached Claude.

     The old message said "that is usually the key being turned off", which is
     exactly wrong here - the key was fine, and the person who hit it went and
     checked a key that was never the problem. */
  const edgeBlock = {
    status: 403,
    message: '403 {"error":{"type":"forbidden","message":"Request not allowed"}}',
    headers: new Headers({ 'x-mvs-stage': 'anthropic', 'cf-ray': 'a4adccce5f5e20f3-HKG' })
  };
  const said = explain(edgeBlock, true);
  assert.match(said.message, /stopped before it reached Claude/);
  assert.match(said.message, /country Claude does not serve/);
  assert.doesNotMatch(said.message, /key being turned off/);
  assert.doesNotMatch(said.message, /out of credit/);
});

test('a 403 that DID reach Claude is still reported as a key problem', () => {
  /* The other 403: it has a request id, so Anthropic itself answered - and
     then the key, the credit or the model really are the things to check. */
  const fromClaude = {
    status: 403,
    message: '403 {"error":{"type":"permission_error","message":"not allowed"}}',
    headers: new Headers({ 'x-mvs-stage': 'anthropic', 'request-id': 'req_123', 'cf-ray': 'abc-BOM' })
  };
  assert.match(explain(fromClaude, true).message, /key being turned off|out of credit/);
});
