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
