/* Turning a failure into a sentence somebody can act on.
 *
 * The studio showed whatever the SDK threw, which meant a teammate's screen
 * read `403 {"error":{"type":"forbidden","message":"Request not allowed"}}`.
 * That is accurate and useless: it does not say whose key, which step, or
 * what to do, and the people using this are not going to read an error
 * envelope.
 *
 * The raw text is kept on the end, because the person who has to fix it is
 * usually not the person who saw it.
 */

export interface Explained {
  /* What to tell the person looking at the screen. */
  message: string;
  /* The original, for whoever they forward it to. */
  detail: string;
}

function statusOf(error: unknown): number | null {
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown };
  for (const value of [e?.status, e?.statusCode]) {
    if (typeof value === 'number') return value;
  }
  /* The SDK puts the status at the front of the message for some failures. */
  const match = String(e?.message ?? '').match(/\b(4\d\d|5\d\d)\b/);
  return match ? Number(match[1]) : null;
}

/* Which of the three things in the chain answered, and its own reference.
 * A 403 can come from this studio's Worker, from Cloudflare in front of it,
 * or from Claude behind it - identical on screen, fixed in three different
 * places. Without these the only way to tell them apart is to guess. */
function traceOf(error: unknown): string {
  const headers = (error as { headers?: unknown })?.headers;
  if (!headers) return '';

  const read = (name: string): string => {
    try {
      if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? '';
      return String((headers as Record<string, unknown>)[name] ?? '');
    } catch {
      return '';
    }
  };

  const parts = [
    read('x-mvs-stage') && `answered by: ${read('x-mvs-stage')}`,
    read('x-mvs-request-id') && `claude request id: ${read('x-mvs-request-id')}`,
    read('request-id') && `request id: ${read('request-id')}`,
    read('cf-ray') && `cloudflare ray: ${read('cf-ray')}`
  ].filter(Boolean);

  return parts.length ? '\n' + parts.join('\n') : '';
}

function rawOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    /* JSON.stringify(undefined) is undefined, not a string, and everything
     * downstream assumes text - the explainer must not be the thing that
     * throws. */
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/* Whether the studio is the one holding the key changes the advice entirely:
 * "ask Aryan to check the key" is wrong if the key is in your own browser. */
export function explain(error: unknown, teamMode: boolean): Explained {
  const detail = rawOf(error) + traceOf(error);
  const status = statusOf(error);
  const text = detail.toLowerCase();

  const keyHolder = teamMode
    ? 'The studio holds one key for the whole team, so this is not something you can fix from here — send this to Aryan.'
    : 'That is the key saved in this browser. Replace it above and try again.';

  /* Before the 401 below: an expired cookie is also a 401, and telling
   * somebody their key is wrong when they simply need to sign in again sends
   * them to the one place they cannot fix it. */
  if (text.includes('session has expired') || text.includes('sign in again')) {
    return { message: 'Your sign-in has expired. Sign in again and the script will still be here.', detail };
  }

  if (status === 401 || text.includes('authentication_error') || text.includes('invalid x-api-key')) {
    return {
      message: `Claude would not accept the key. ${keyHolder}`,
      detail
    };
  }

  /* A 403 that carries a Cloudflare ray and NO request id never reached
   * Claude: it was refused by the edge sitting in front of Anthropic. The
   * commonest reason is where the request happened to come FROM - Anthropic
   * does not serve every country - and the key is fine.
   *
   * This has to come before the general 403 below, which says the opposite
   * and is what sent the first person who hit this to check a key that was
   * never the problem. */
  if (status === 403 && /cloudflare ray:/.test(detail) && !/request id:/.test(detail)) {
    return {
      message:
        'The request was stopped before it reached Claude - by the network in front of Claude, ' +
        'not by Claude and not by the key. This usually means it was sent from a country Claude ' +
        'does not serve. Nothing is wrong with your script or your sign-in. Send this to Aryan: ' +
        'it is fixed in the studio settings, not from here.',
      detail
    };
  }

  if (status === 403 || text.includes('forbidden') || text.includes('permission_error')) {
    return {
      message:
        'Something refused the request before Claude could answer it. That is usually the key ' +
        'being turned off, out of credit, or not allowed to use this model - but it can also be ' +
        `the connection in between. ${keyHolder} Open "What it said exactly" and send that too.`,
      detail
    };
  }

  if (status === 429 || text.includes('rate_limit')) {
    return {
      message: 'Claude is being asked for too much at once. Wait a minute and try again — nothing is broken.',
      detail
    };
  }

  if (status === 529 || text.includes('overloaded')) {
    return {
      message: 'Claude is overloaded at the moment. Try again in a minute — nothing is broken.',
      detail
    };
  }

  if (status !== null && status >= 500) {
    return {
      message: 'Claude had a problem at its end. Try again in a minute.',
      detail
    };
  }

  if (text.includes('not finished being set up')) {
    return {
      message: 'This studio is not finished being set up. Send this to Aryan — it is a missing setting, not anything you did.',
      detail
    };
  }

  if (text.includes('failed to fetch') || text.includes('networkerror') || text.includes('load failed')) {
    return { message: 'The studio could not be reached. Check the connection and try again.', detail };
  }

  return {
    message: detail || 'Something went wrong reading the script.',
    detail
  };
}
