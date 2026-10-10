import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signSession, verifySession, sameSecret, readCookie, cookieHeader, clearCookie, SESSION_DAYS
} from '../cf/src/auth.js';

const SECRET = 'a-session-secret';

test('a session this worker signed verifies', async () => {
  assert.equal(await verifySession(await signSession(SECRET), SECRET), true);
});

test('a session signed with another secret does not verify', async () => {
  assert.equal(await verifySession(await signSession('someone-elses'), SECRET), false);
});

test('a tampered payload does not verify', async () => {
  const good = await signSession(SECRET);
  const i = good.lastIndexOf('.');
  const forged = 'ok.' + (Date.now() + 5) + good.slice(i);
  assert.equal(await verifySession(forged, SECRET), false);
});

test('an expired session does not verify', async () => {
  /* Signed correctly, but issued longer ago than a session may last - a cookie
   * copied off someone's machine has to stop working on its own. */
  const stale = Date.now() - (SESSION_DAYS * 86400 * 1000 + 1000);
  const { createHmac } = await import('node:crypto');
  const payload = 'ok.' + stale;
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64').replace(/=+$/, '');
  assert.equal(await verifySession(payload + '.' + sig, SECRET), false);
});

test('garbage and empties do not verify', async () => {
  for (const v of ['', null, undefined, 'nonsense', 'ok.123']) {
    assert.equal(await verifySession(v, SECRET), false, `${v} must not verify`);
  }
});

test('sameSecret matches only identical strings', () => {
  assert.equal(sameSecret('hunter2', 'hunter2'), true);
  assert.equal(sameSecret('hunter2', 'hunter3'), false);
  assert.equal(sameSecret('hunter2', 'hunter22'), false);
  assert.equal(sameSecret('', ''), true);
  assert.equal(sameSecret(undefined, 'x'), false);
  assert.equal(sameSecret('x', undefined), false);
});

test('the cookie is read back out of a header', () => {
  const value = 'ok.1.sig';
  const req = { headers: { get: () => `other=1; mvs_session=${value}; more=2` } };
  assert.equal(readCookie(req), value);
});

test('no cookie reads as null', () => {
  assert.equal(readCookie({ headers: { get: () => '' } }), null);
});

test('the session cookie is not readable by scripts and not sent cross-site', () => {
  const h = cookieHeader('x');
  assert.match(h, /HttpOnly/);
  assert.match(h, /Secure/);
  assert.match(h, /SameSite=Lax/);
});

test('clearing the cookie expires it immediately', () => {
  assert.match(clearCookie(), /Max-Age=0/);
});
