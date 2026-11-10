/* Reading a script with somebody else's AI.
 *
 * The studio's own path asks Claude for the shot list against a schema. That
 * costs money, and the people writing these videos are not the people with
 * the API budget - so this is the same job done with whatever key the viewer
 * already has. Gemini and Grok both have a free tier.
 *
 * It does NOT reimplement the instructions. Every provider is sent the same
 * briefing the studio already generates for pasting into a chat window, and
 * answers with YAML, which goes through the studio's own validator exactly as
 * a hand-written shot list does. So a provider can only ever be wrong in the
 * ways a person pasting by hand can be wrong, and the validator catches those
 * already.
 *
 * The key is the viewer's own. It is kept in their browser and sent to that
 * provider and nowhere else - this studio has no server of its own to send it
 * to, outside team mode.
 */

export type ProviderId = 'anthropic' | 'gemini' | 'grok';

export type Provider = {
  id: ProviderId;
  name: string;
  /* What a key from this provider looks like, so a key pasted into the wrong
     box is obvious before it is ever sent. */
  looksLike: RegExp;
  hint: string;
  where: string;
  whereUrl: string;
  defaultModel: string;
  free: string;
};

/* GEMINI IS FIRST, and first here means default - providerById falls back to
 * PROVIDERS[0] and the picker opens on it. It leads because it is the only
 * one of the three with a free tier big enough to run the studio on, and the
 * studio's whole running cost is this one call.
 *
 * The model is Flash-LITE rather than Flash. Google's own model list calls it
 * "the fastest, most cost-effective" of its generation, and this job is the
 * one that suits it: not writing, but reading a script into a fixed
 * vocabulary of screens that is handed to it in the prompt, with the
 * studio's validator behind it to catch anything it gets wrong. Flash-Lite
 * also takes the "minimal" thinking level, which the bigger Flash does not -
 * see buildRequest. */
export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    looksLike: /^AIza/,
    hint: 'AIza…',
    where: 'aistudio.google.com',
    whereUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-3.5-flash-lite',
    free: 'Free tier. The fastest of them, and what the studio opens on.'
  },
  {
    id: 'anthropic',
    name: 'Claude',
    looksLike: /^sk-ant-/,
    hint: 'sk-ant-…',
    where: 'console.anthropic.com',
    whereUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-5-5',
    free: 'Paid, but pennies a script. Reads it against the studio’s own schema.'
  },
  {
    id: 'grok',
    name: 'Grok',
    looksLike: /^xai-/,
    hint: 'xai-…',
    where: 'console.x.ai',
    whereUrl: 'https://console.x.ai',
    defaultModel: 'grok-4',
    free: 'Has free credits. Good enough for a shot list.'
  }
];

export const providerById = (id: string): Provider =>
  PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];

/* Which provider a pasted key belongs to, so nobody has to be told twice. */
export function providerOfKey(key: string): ProviderId | null {
  const trimmed = key.trim();
  return PROVIDERS.find(p => p.looksLike.test(trimmed))?.id ?? null;
}

export type Request = { url: string; headers: Record<string, string>; body: string };

/* One prompt, three shapes of envelope. Kept as data rather than three
 * branches of fetch so each one can be checked without a network or a key. */
export type How = {
  /* Set when a first try came back complaining about the thinking setting -
   * see askProvider. The request is then sent again without it. */
  withoutThinking?: boolean;
  /* Team mode: the studio's own Worker, which holds the key. The request is
   * otherwise identical, and the key field goes empty rather than being
   * filled with a placeholder nobody reads - in team mode the browser has no
   * key, which is the entire point of team mode. */
  baseUrl?: string;
};

export function buildRequest(
  id: ProviderId, key: string, model: string, prompt: string, how: How = {}
): Request {
  const { withoutThinking = false, baseUrl } = how;

  if (id === 'gemini') {
    const path = `v1beta/models/${encodeURIComponent(model)}:generateContent`;
    return {
      url: baseUrl ? `${baseUrl}/api/gemini/${path}` : `https://generativelanguage.googleapis.com/${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...(baseUrl ? {} : { 'x-goog-api-key': key })
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          /* Low temperature: this is transcription of a script into a fixed
             vocabulary of screens, not writing. */
          temperature: 0.2,
          maxOutputTokens: 8192,
          /* Flash models think before answering and are shipped with it ON -
           * on 3.8 Flash the default is "medium". Thinking is time the viewer
           * waits and tokens somebody pays for, and this job does not want
           * any: the screens it may use are listed in the prompt and the
           * validator catches whatever it still gets wrong. It is the same
           * judgement as the "low" effort on the Claude path, which was made
           * there and then not acted on for a year.
           *
           * "minimal" is not offered by every model - the bigger 3.8 Flash
           * stops at "low" - and the field itself may be renamed under us, as
           * Google has already renamed models under us once. So it is sent
           * hopefully: askProvider sends the whole request again without it
           * if Google objects, and a studio that is merely slower is a far
           * better failure than one that is broken. */
          ...(withoutThinking ? {} : { thinkingConfig: { thinkingLevel: 'minimal' } })
        }
      })
    };
  }

  if (id === 'grok') {
    return {
      url: 'https://api.x.ai/v1/chat/completions',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      })
    };
  }

  throw new Error(`${id} is read through the studio's own path, not this one.`);
}

/* The answer, whatever it is wrapped in. */
export function extractText(id: ProviderId, payload: unknown): string {
  const data = payload as Record<string, any>;

  if (id === 'gemini') {
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? '').join('') : '';
    if (text.trim()) return text;
    /* Gemini answers a refusal with no parts at all and a reason beside it,
       which is otherwise an empty box and no explanation. */
    const why = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason;
    throw new Error(why ? `Gemini stopped: ${why}.` : 'Gemini sent nothing back.');
  }

  if (id === 'grok') {
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (typeof text === 'string' && text.trim()) return text;
    throw new Error('Grok sent nothing back.');
  }

  throw new Error(`No reader for ${id}.`);
}

/* The shot list out of whatever the model wrapped it in.
 *
 * Models fence code even when told not to, so the fence comes off. Features
 * no screen can show arrive as comment lines, because YAML has nowhere else
 * to put them - the briefing asks for exactly this. */
export function recipeFromText(text: string): { recipe: string; unsupported: string[] } {
  let body = text.trim();

  const fenced = body.match(/```(?:ya?ml)?\s*\n([\s\S]*?)```/);
  if (fenced) body = fenced[1].trim();

  const unsupported: string[] = [];
  const kept: string[] = [];
  for (const line of body.split('\n')) {
    const note = line.match(/^#\s*Not shown:\s*(.+)$/i);
    if (note) unsupported.push(note[1].trim());
    else kept.push(line);
  }

  return { recipe: kept.join('\n').trim() + '\n', unsupported };
}

/* The model a provider says to use instead of the one that was asked for.
 *
 * A model name written into this file goes stale on somebody else's
 * schedule: Google retired gemini-2.5-flash for new keys and answered the
 * call with a 404 naming its replacement. The name in PROVIDERS is kept
 * current, but the next retirement would be another dead studio until
 * somebody edited this file again - and the people using it cannot. So when
 * a provider refuses a model AND names another one, that one is tried.
 *
 * The refusal names the dead model too, so only a name that is not the one
 * just asked for counts. Nothing is retried that is not a 404 about a model:
 * a bad key must stay a bad key. */
/* Is this refusal about the thinking setting rather than about the request?
 *
 * Matched on the field name rather than on a message, because the message is
 * Google's to reword and the field name is the thing we sent. A refusal about
 * anything else must stay a refusal: a bad key that quietly retried itself
 * without thinking would just fail twice and report the second one. */
export function objectsToThinking(detail: string): boolean {
  return /thinking(_|-)?(level|budget|config)/i.test(detail);
}

export function replacementModel(asked: string, detail: string): string | null {
  if (!/model/i.test(detail)) return null;
  const named = [...detail.matchAll(/models\/([A-Za-z0-9][\w.\-]*)/g)].map(m => m[1]);
  return named.find(n => n !== asked) ?? null;
}

/* Ask, and hand back a shot list. Everything specific to a provider is in the
 * two functions above; this is the same for all of them. */
export async function askProvider(
  { id, key, model, prompt }: { id: ProviderId; key: string; model: string; prompt: string },
  /* Set when this is already the second try, so a provider that renames a
   * model in a circle cannot keep the page asking forever. */
  retried = false,
  /* withoutThinking is set once the thinking setting has already been
   * dropped, so a provider that objects to something else cannot send this
   * round in a circle. */
  how: How = {}
): Promise<{ recipe: string; unsupported: string[] }> {
  const request = buildRequest(id, key, model, prompt, how);

  let response: Response;
  try {
    response = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body });
  } catch {
    /* A browser refuses a cross-site call without telling the page why, so
       there is nothing here to report but the fact of it. */
    throw new Error(
      `The ${providerById(id).name} API could not be reached from this page. ` +
      'That is usually the provider refusing calls from a browser rather than anything ' +
      'wrong with the key. Use the copy-and-paste way below instead.'
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');

    if (response.status === 404 && !retried) {
      const instead = replacementModel(model, detail);
      if (instead) return askProvider({ id, key, model: instead, prompt }, true, how);
    }

    /* The thinking setting is an optimisation, never a requirement. If this
     * model has not got it, or Google has renamed the field again, the right
     * answer is a slower clip rather than no clip - so it is dropped and the
     * whole thing asked again, once. */
    if (!how.withoutThinking && objectsToThinking(detail)) {
      return askProvider({ id, key, model, prompt }, retried, { ...how, withoutThinking: true });
    }

    throw Object.assign(
      new Error(`${response.status} ${detail.slice(0, 600)}`),
      { status: response.status }
    );
  }

  return recipeFromText(extractText(id, await response.json()));
}

/* Where each key is kept.
 *
 * The studio used to keep ONE key, under one name, whatever provider it
 * belonged to - so picking a different AI left the previous AI's key in
 * place and sent it onward. x.ai answers that with "Incorrect API key
 * provided", which reads like a bad key rather than somebody else's key, and
 * Google answers the same mix-up with "API key not valid". Aryan hit both in
 * one sitting. A key belongs to the provider it came from, so each provider
 * now has its own slot.
 */
export type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/* The name the single shared key used to be kept under. */
const LEGACY_SLOT = 'mbb-anthropic-key';

export const PROVIDER_SLOT = 'mbb-ai-provider';

export const keySlotFor = (id: ProviderId): string => `mbb-key-${id}`;

export function readKey(store: KeyStore, id: ProviderId): string {
  try { return store.getItem(keySlotFor(id))?.trim() ?? ''; } catch { return ''; }
}

export function writeKey(store: KeyStore, id: ProviderId, key: string): void {
  try { store.setItem(keySlotFor(id), key.trim()); } catch { /* private mode */ }
}

/* The one old key, filed under whoever it actually belongs to. Its shape
 * says so; failing that, the provider that was selected when it was saved.
 * Runs once - afterwards there is nothing in the old slot to move. */
export function migrateKey(store: KeyStore): void {
  try {
    const old = store.getItem(LEGACY_SLOT)?.trim();
    store.removeItem(LEGACY_SLOT);
    if (!old) return;
    const id = providerOfKey(old)
      ?? (PROVIDERS.find(p => p.id === store.getItem(PROVIDER_SLOT))?.id ?? 'anthropic');
    if (!readKey(store, id)) writeKey(store, id, old);
  } catch { /* private mode */ }
}
