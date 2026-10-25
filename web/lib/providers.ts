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

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    looksLike: /^sk-ant-/,
    hint: 'sk-ant-…',
    where: 'console.anthropic.com',
    whereUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-opus-5-5',
    free: 'Paid. Reads the script against the studio’s own schema.'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    looksLike: /^AIza/,
    hint: 'AIza…',
    where: 'aistudio.google.com',
    whereUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-2.5-flash',
    free: 'Has a free tier. Good enough for a shot list.'
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
export function buildRequest(id: ProviderId, key: string, model: string, prompt: string): Request {
  if (id === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        /* Low temperature: this is transcription of a script into a fixed
           vocabulary of screens, not writing. */
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
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

/* Ask, and hand back a shot list. Everything specific to a provider is in the
 * two functions above; this is the same for all of them. */
export async function askProvider(
  { id, key, model, prompt }: { id: ProviderId; key: string; model: string; prompt: string }
): Promise<{ recipe: string; unsupported: string[] }> {
  const request = buildRequest(id, key, model, prompt);

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
