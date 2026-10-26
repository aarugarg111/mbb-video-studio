/* Calling Anthropic from somewhere Anthropic answers.
 *
 * A Worker runs in the Cloudflare data centre nearest whoever opened the
 * page, and its call to Anthropic leaves from there. Anthropic refuses
 * requests from places it does not serve, at its own edge, before the key is
 * ever looked at. So the studio stops working for one person and nobody
 * else, and it looks exactly like the key being turned off - which is the
 * first thing everybody checks, and it is never that.
 *
 * The part that misleads everyone: the teammates this happened to were in
 * BANGALORE, and the ray said HKG. India is served. Cloudflare routes by
 * network peering rather than by geography, and a great deal of Indian
 * traffic reaches it through Hong Kong - so the person was in a supported
 * country and their REQUEST was not. "They are in India, so it cannot be a
 * region problem" is the wrong conclusion and the first one anybody reaches.
 *
 * Smart placement was the first attempt at this and is not enough. It moves
 * a Worker towards what it talks to as a latency optimisation; it needs
 * traffic before it decides anything, it is free to change its mind, and it
 * never promises a region. It happened twice more with it switched on.
 *
 * A Durable Object does promise one. It is created with a location hint and
 * then it stays put, so the call to Anthropic leaves from the same place for
 * everybody - whoever opened the page, and wherever Cloudflare happened to
 * route them. The page itself is still served from the edge, so nothing
 * about the studio got slower to load.
 *
 * This object keeps nothing. It exists for its address.
 */

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

export class Egress {
  constructor(state, env) {
    this.env = env;
  }

  async fetch(request) {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Expected JSON.' }), { status: 400 });
    }

    /* The key is read here rather than passed in: it belongs to the thing
     * that talks to Anthropic, and one place that knows it is easier to keep
     * right than two. Trimmed for the reason it always was - `wrangler
     * secret put` stores whatever the terminal gave it, and a key with a
     * trailing newline comes back as "invalid x-api-key", which reads like
     * the wrong key rather than the right one with a character stuck to it. */
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': String(this.env.ANTHROPIC_API_KEY).trim(),
      'anthropic-version': payload.version || '2023-06-01'
    };
    if (payload.beta) headers['anthropic-beta'] = payload.beta;

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload.body)
    });

    /* Passed back whole. Which refusal this is matters upstream of here -
     * an edge refusal carries a ray and no request id, and that is the one
     * difference that says whether to try somewhere else. */
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        ...(upstream.headers.get('cf-ray') ? { 'cf-ray': upstream.headers.get('cf-ray') } : {}),
        ...(upstream.headers.get('request-id') ? { 'request-id': upstream.headers.get('request-id') } : {})
      }
    });
  }
}

/* Where the call may leave from, in the order they are tried.
 *
 * Both are in the United States, which Anthropic serves and which is where
 * its API is - so this is also the shortest hop. The second is here because
 * a location hint is a hint: Cloudflare places a new object near the region
 * asked for and is allowed to do otherwise, and an object that ended up
 * somewhere refused should not leave the studio broken for good.
 */
export const REGIONS = ['enam', 'wnam'];

/* A refusal that never reached Anthropic.
 *
 * Anthropic's API gives every answer a request id, including its refusals.
 * A 403 with no request id was issued in front of the API - by the network
 * that decides which places are served - and that is the only 403 worth
 * trying somewhere else. A genuine "this request is forbidden" would be
 * refused identically everywhere, and retrying it would just spend another
 * region's worth of time saying the same thing.
 */
export function blockedBeforeAnthropic(response) {
  return response.status === 403 && !response.headers.get('request-id');
}
