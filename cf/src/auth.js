/* Shared-password login, the same shape Script Studio uses: no accounts, no
 * database - a signed cookie is the whole session. The password is checked
 * here so that the API key never has to leave Cloudflare. */

import { sameSecret } from '../../src/secret.js';

export { sameSecret };

const enc = new TextEncoder();

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '');
}


export const SESSION_DAYS = 7;

export async function signSession(secret) {
  const payload = 'ok.' + Date.now();
  return payload + '.' + await hmac(secret, payload);
}

/* Rejects a session whose signature does not match AND one that has simply
 * grown old, so a cookie copied off a machine stops working on its own. */
export async function verifySession(value, secret) {
  if (!value) return false;
  const i = value.lastIndexOf('.');
  if (i < 0) return false;
  const payload = value.slice(0, i), sig = value.slice(i + 1);
  if (!sameSecret(sig, await hmac(secret, payload))) return false;
  const issued = Number(payload.split('.')[1]);
  if (!Number.isFinite(issued)) return false;
  return Date.now() - issued < SESSION_DAYS * 86400 * 1000;
}

export function cookieHeader(value) {
  return `mvs_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearCookie() {
  return 'mvs_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export function readCookie(request) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(/(?:^|;\s*)mvs_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
