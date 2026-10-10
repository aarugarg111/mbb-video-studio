/* Team mode: the studio talks to its own Worker, which holds the Anthropic key
 * and checks a shared password. Nobody on the team handles a key, and the key
 * can be replaced in one place without anyone noticing.
 *
 * Off by default, so the same build still runs as a static page where each
 * person brings their own key. The Worker build turns it on. */
export const TEAM_MODE = process.env.NEXT_PUBLIC_TEAM_MODE === '1';

/* The SDK appends /v1/messages, so this is the prefix the Worker routes on. */
export function proxyBaseUrl(): string {
  return (typeof window === 'undefined' ? '' : window.location.origin) + '/api/anthropic';
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch { /* a non-JSON body means the message below is the best there is */ }
  return fallback;
}

export async function signIn(password: string): Promise<void> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) throw new Error(await readError(res, 'That password is not right.'));
}

export async function signOut(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' });
}

/* Returns false rather than throwing when the Worker cannot be reached: a page
 * that cannot tell should ask for the password, not break. */
export async function isSignedIn(): Promise<boolean> {
  try {
    const res = await fetch('/api/session');
    if (!res.ok) return false;
    return Boolean((await res.json())?.signedIn);
  } catch {
    return false;
  }
}
