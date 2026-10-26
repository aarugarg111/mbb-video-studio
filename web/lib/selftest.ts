/* A check somebody can run on the machine where it is broken.
 *
 * The studio works for most people and fails for a few, which means the fault
 * is somewhere along one person's own path to it - their network, something
 * between them and Cloudflare, or Claude refusing that particular request.
 * Those look identical from the outside, and two rounds of screenshots did not
 * tell them apart.
 *
 * So this walks the chain one hop at a time and says which hop broke. Each
 * step reports what answered it, so the result can be pasted to whoever has to
 * fix it.
 */

export type Outcome = 'ok' | 'failed' | 'skipped';

export interface Step {
  name: string;
  outcome: Outcome;
  detail: string;
}

/* Who answered. Our Worker stamps this on everything it returns, so its
 * ABSENCE is itself a finding: the reply did not come from the studio. */
function stageOf(res: Response): string {
  return res.headers.get('x-mvs-stage') || 'not the studio';
}

function traceOf(res: Response): string {
  const bits = [
    `HTTP ${res.status}`,
    `answered by: ${stageOf(res)}`,
    res.headers.get('x-mvs-request-id') && `claude request id: ${res.headers.get('x-mvs-request-id')}`,
    /* Where the studio called Claude FROM. Anthropic refuses whole regions at
       its own edge, and the studio pins its call to one that is served - so a
       report carrying no region came from a studio deployed before that fix,
       which is a different thing to go and look at. */
    stageOf(res) === 'anthropic' && (
      res.headers.get('x-mvs-egress')
        ? `called claude from: ${res.headers.get('x-mvs-egress')}`
        : 'called claude from: wherever the viewer is - this studio is not pinned, so redeploy it'
    ),
    res.headers.get('x-mvs-cf-ray') && `cloudflare ray (claude side): ${res.headers.get('x-mvs-cf-ray')}`,
    res.headers.get('cf-ray') && `cloudflare ray: ${res.headers.get('cf-ray')}`
  ].filter(Boolean);
  return bits.join(' · ');
}

/* The smallest request that still goes the whole way to Claude. It costs a
 * fraction of a paisa, which is worth it to find out whether the path works
 * at all. */
const PING = {
  model: 'claude-opus-5-5',
  max_tokens: 1,
  messages: [{ role: 'user', content: 'hi' }]
};

export async function runSelfTest(fetchImpl: typeof fetch = fetch): Promise<Step[]> {
  const steps: Step[] = [];

  /* 1. Can this machine reach the studio's own server at all? */
  let session: Response;
  try {
    session = await fetchImpl('/api/session', { method: 'GET' });
  } catch (err) {
    steps.push({
      name: 'Reaching the studio',
      outcome: 'failed',
      detail:
        'The studio could not be reached from this machine at all. That is this ' +
        'network or something on it - a company proxy, a VPN, or an extension - ' +
        'rather than the studio itself. ' + String((err as Error)?.message ?? err)
    });
    steps.push({ name: 'Signed in', outcome: 'skipped', detail: 'Not checked - the studio was not reachable.' });
    steps.push({ name: 'Reaching Claude', outcome: 'skipped', detail: 'Not checked - the studio was not reachable.' });
    return steps;
  }

  const reachedStudio = session.headers.get('x-mvs-stage') === 'worker';
  steps.push({
    name: 'Reaching the studio',
    outcome: session.ok && reachedStudio ? 'ok' : 'failed',
    detail: reachedStudio
      ? traceOf(session)
      : `${traceOf(session)} - this reply did not come from the studio, so something in ` +
        'between answered instead. That is usually a company proxy or a security filter.'
  });

  /* 2. Is the sign-in cookie actually being kept? Some privacy settings and
   *    company profiles drop it, which looks exactly like being signed out. */
  let signedIn = false;
  try {
    signedIn = Boolean((await session.clone().json())?.signedIn);
  } catch {
    /* not JSON - already covered by the step above */
  }
  steps.push({
    name: 'Signed in',
    outcome: signedIn ? 'ok' : 'failed',
    detail: signedIn
      ? 'The sign-in is being remembered.'
      : 'This browser is not signed in, or is not keeping the sign-in cookie. ' +
        'Sign in again; if it keeps happening, this browser is blocking the cookie.'
  });

  if (!signedIn) {
    steps.push({ name: 'Reaching Claude', outcome: 'skipped', detail: 'Not checked - not signed in.' });
    return steps;
  }

  /* 3. The hop that has actually been failing. */
  try {
    const res = await fetchImpl('/api/anthropic/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(PING)
    });

    if (res.ok) {
      steps.push({ name: 'Reaching Claude', outcome: 'ok', detail: traceOf(res) });
    } else {
      const body = await res.text();
      const reachedClaude = Boolean(res.headers.get('x-mvs-request-id'));
      steps.push({
        name: 'Reaching Claude',
        outcome: 'failed',
        detail:
          `${traceOf(res)} - ` +
          (reachedClaude
            ? 'Claude itself refused this. That is the key, its credit, or what it is allowed to use.'
            : 'this never reached Claude - something in between refused it first.') +
          `\n${body.slice(0, 400)}`
      });
    }
  } catch (err) {
    steps.push({
      name: 'Reaching Claude',
      outcome: 'failed',
      detail:
        'The request never completed. On a company network this is usually a proxy or ' +
        'filter cutting it off. ' + String((err as Error)?.message ?? err)
    });
  }

  return steps;
}

/* One block of text, ready to paste to whoever has to act on it. */
export function asReport(steps: Step[]): string {
  const mark = (o: Outcome) => (o === 'ok' ? 'OK' : o === 'failed' ? 'FAILED' : 'skipped');
  return [
    'myBillBook Video Studio - connection check',
    new Date().toISOString(),
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    '',
    ...steps.map(s => `${mark(s.outcome)}  ${s.name}\n      ${s.detail}`)
  ].join('\n');
}
