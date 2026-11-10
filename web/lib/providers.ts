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

import * as yaml from 'js-yaml';
/* Shared with the command line, so the two cannot disagree about which laptop
   screen stands in for which phone screen. */
import { recastShape } from '../../src/shape.js';
import { catalogue } from '../../screens/index.js';
import { explain } from './errors';

export type ProviderId = 'gemini';

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

/* GEMINI IS THE ONLY ONE.
 *
 * The studio used to offer three - Claude against a schema, Gemini and Grok
 * against a briefing - and the whole running cost of the tool was whichever
 * one it reached for. Gemini has a free tier that covers this comfortably,
 * so the others were a paid way of doing a job that is already free, kept
 * around for a choice nobody benefits from making. They are gone, and with
 * them the Anthropic SDK that used to ship in the page.
 *
 * It is a LIST of one rather than a bare constant because the rest of the
 * studio already asks it questions - which provider a key belongs to, where
 * to get one, what to default to - and those answers stay the same shape.
 * Adding a second one back is adding an entry here.
 *
 * The model is Flash-LITE rather than Flash. Google's own model list calls it
 * "the fastest, most cost-effective" of its generation, and this job suits
 * it: not writing, but reading a script into a fixed vocabulary of screens
 * handed to it in the prompt, with the studio's validator behind it. It also
 * takes the "minimal" thinking level, which the bigger Flash does not - see
 * buildRequest. */
export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    looksLike: /^AIza/,
    hint: 'AIza…',
    where: 'aistudio.google.com',
    whereUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-3.5-flash-lite',
    free: 'Free tier, and the fastest of them. Nothing here costs anything to run.'
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
/* How hard the model thinks before answering.
 *
 * This was 'minimal', hardcoded, chosen to make the studio fast. It was the
 * wrong trade and it was made silently: the brief was to cut cost WITHOUT
 * cutting quality, and turning the model's reasoning down is cutting quality
 * - it just does not show up on a bill. The shot lists came back less crisp
 * and nothing in the eval could see it, because the eval was not measuring
 * crispness either.
 *
 * It is one named constant now so the eval can measure the difference, and
 * so changing it is one edit rather than an archaeology expedition.
 *
 * Measured, on the eight eval scripts, rather than argued about:
 *
 *   3.5-flash-lite  minimal   8/8 parsed  8/8 kept the point   7.1s
 *   3.5-flash-lite  low       8/8 parsed  8/8 kept the point  12.0s
 *
 * Thinking harder did NOT read as crisper - the roughness counts came out
 * level, inside the noise of eight scripts - and it costs seventy per cent
 * more waiting. So 'minimal' stands, now on evidence instead of on my
 * assumption that less thinking was what made the shot lists rough. It was
 * not, and the eval said so the first time it was asked properly. */
export const THINKING = 'minimal';

export type How = {
  /* Set when a first try came back complaining about the thinking setting -
   * see askProvider. The request is then sent again without it. */
  withoutThinking?: boolean;
  /* Set once a transient failure has been waited out, so a provider having a
   * bad minute cannot hold somebody in a loop. */
  afterWaiting?: boolean;
  /* How hard the model thinks before answering. Overrides THINKING, and
   * exists so the eval can measure the difference rather than argue about
   * it - see the note on THINKING. */
  thinking?: string;
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
          ...(withoutThinking ? {} : { thinkingConfig: { thinkingLevel: how.thinking ?? THINKING } })
        }
      })
    };
  }

  throw new Error(`There is no request builder for ${id}.`);
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

  throw new Error(`No reader for ${id}.`);
}

/* The shot list, moved onto the shape the picker actually asked for.
 *
 * This used to happen only on the Claude path, and the reason it was written
 * there is a documented failure rather than a precaution: a shot list came
 * back on PHONE screens whatever the picker said, because the script's own
 * "Internal team adds: UI" markers name phone screens and the model follows
 * the script in front of it. Asking is a request; this is the part that
 * cannot be ignored.
 *
 * When Claude was removed, that left the only remaining path - this one -
 * merely asking. So it moved here. It is the same recastShape the command
 * line uses, so a clip rendered in the studio and the same recipe rendered
 * from a terminal cannot disagree about which screen is the laptop one.
 *
 * Deliberately NOT run through src/recipe.js first. That would normalise the
 * recipe - filling in every default - and hand the person checking the shot
 * list a page of YAML they did not write. Only the screens and taps are
 * touched here; everything else stays in the model's own words, and the real
 * validation happens where it always did, one step later.
 *
 * Anything unparseable is returned untouched rather than thrown away: the
 * validator reports a broken recipe far better than this could, and a recipe
 * this cannot read is exactly the one somebody needs to see. */
export function castToShape(
  recipeText: string, shape?: string
): { recipe: string; unsupported: string[] } {
  if (!shape) return { recipe: recipeText, unsupported: [] };

  let doc: { shots?: unknown } | null;
  try {
    doc = yaml.load(recipeText) as { shots?: unknown } | null;
  } catch {
    return { recipe: recipeText, unsupported: [] };
  }
  if (!doc || !Array.isArray(doc.shots)) return { recipe: recipeText, unsupported: [] };

  const { recipe, dropped } = recastShape(doc, shape, catalogue() as Record<string, string[]>);
  return {
    recipe: yaml.dump(recipe),
    /* A tap with no equivalent on the other shape is REPORTED, never quietly
       dropped - the person checking the shot list is the one who can decide
       whether it mattered. */
    unsupported: (dropped as string[]).map(
      d => `${d} - no equivalent on a ${shape}, so that tap is left out`
    )
  };
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
  /* A SPACE counts as a separator too. Without it this matched the field
   * name - "thinkingLevel", "thinking_budget" - and not the sentence Google
   * actually writes:
   *
   *   Thinking level MINIMAL is not supported for this model.
   *
   * So the fallback built for precisely this refusal never fired, and the
   * bigger Flash model failed outright on every single script instead of
   * being asked again without the setting. The comment on THINKING even
   * predicted the refusal; the guard against it was one character short.
   * Found by measuring, not by reading. */
  return /thinking[\s_-]?(level|budget|config)/i.test(detail);
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

    /* Google having a bad minute. Measuring the free tier turned up one 500
     * in five calls, and the studio made exactly one attempt - so a support
     * person helping a customer on the phone loses the clip to a fault that
     * had already passed. There is one paid-for-free call in the whole
     * studio; asking it twice costs a second and a half and nothing else.
     *
     * Only the statuses that mean "not now" rather than "not ever": a 401 or
     * a 400 asked again is the same answer with the viewer kept waiting. */
    const notNow =
      response.status === 429 ||
      /* 500, 502, 503, 504 - but NOT 501, which is this studio's own Worker
       * saying it has no key configured. Retrying that waits a second and a
       * half to be told the same permanent thing twice. */
      (response.status >= 500 && response.status !== 501);

    if (!how.afterWaiting && notNow && !detail.includes('not-configured')) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return askProvider({ id, key, model, prompt }, retried, { ...how, afterWaiting: true });
    }

    /* Put through the explainer rather than thrown raw. This used to show
     * the viewer `403 {"error":{"type":"forbidden",...}}`, which is accurate
     * and useless: it says nothing about whose key, which step, or what to
     * do. The explainer was written for the Claude path and outlived it -
     * most of what it knows is about HTTP and about the person reading the
     * screen, not about a vendor. */
    const raw = Object.assign(
      new Error(`${response.status} ${detail.slice(0, 600)}`),
      { status: response.status }
    );
    const { message, detail: full } = explain(raw, Boolean(how.baseUrl));
    throw Object.assign(new Error(message), { status: response.status, detail: full });
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
      ?? PROVIDERS[0].id;
    if (!readKey(store, id)) writeKey(store, id, old);
  } catch { /* private mode */ }
}
