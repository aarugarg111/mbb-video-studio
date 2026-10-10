/* Comparing a secret to what someone typed.
 *
 * Lives here, in the shared code, because three places need it: the login the
 * Cloudflare Worker checks, the token the render service checks, and anything
 * that comes after. A second copy of a security check is a copy that gets
 * fixed once.
 */

/* Compares in constant time. A plain === leaks how much of the password was
 * right through how long the comparison took, which is enough to recover a
 * short one guess by guess. */
export function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
