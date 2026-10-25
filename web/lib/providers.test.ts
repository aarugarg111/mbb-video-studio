import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/recipe.js';
import { catalogue, scrollables } from '../../screens/index.js';
import {
  PROVIDERS, providerById, providerOfKey, buildRequest, extractText, recipeFromText,
  readKey, writeKey, migrateKey, keySlotFor, replacementModel, askProvider
} from './providers';

test('a key goes to the provider it came from', () => {
  /* Pasting a Gemini key into a box set to Grok is the obvious first mistake,
     and the provider answers it with "unauthorised", which reads like the key
     is wrong rather than in the wrong place. */
  assert.equal(providerOfKey('AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxx'), 'gemini');
  assert.equal(providerOfKey('xai-abcdefghijklmnop'), 'grok');
  assert.equal(providerOfKey('sk-ant-api03-xxxx'), 'anthropic');
  assert.equal(providerOfKey('  AIzaWithSpaces  '), 'gemini', 'a pasted key brings whitespace');
  assert.equal(providerOfKey('hello'), null, 'and anything else is not guessed at');
});

test('each provider is asked in the shape it expects', () => {
  const gem = buildRequest('gemini', 'AIzaKEY', 'gemini-3.8-flash', 'BRIEFING');
  assert.match(gem.url, /generativelanguage\.googleapis\.com/);
  assert.match(gem.url, /gemini-3.8-flash:generateContent$/);
  /* The key goes in a header, never in the URL: a URL ends up in logs,
     history and referrers. */
  assert.equal(gem.headers['x-goog-api-key'], 'AIzaKEY');
  assert.ok(!gem.url.includes('AIzaKEY'), 'the key is in the address bar');
  assert.match(JSON.parse(gem.body).contents[0].parts[0].text, /BRIEFING/);

  const grok = buildRequest('grok', 'xai-KEY', 'grok-4', 'BRIEFING');
  assert.equal(grok.url, 'https://api.x.ai/v1/chat/completions');
  assert.equal(grok.headers.Authorization, 'Bearer xai-KEY');
  const body = JSON.parse(grok.body);
  assert.equal(body.model, 'grok-4');
  assert.equal(body.messages[0].content, 'BRIEFING');
});

test('a model name with something odd in it cannot escape the address', () => {
  const req = buildRequest('gemini', 'k', '../../models/other', 'x');
  assert.ok(!req.url.includes('../'), `a path climbed out of the address: ${req.url}`);
});

test('the answer is found wherever each provider puts it', () => {
  assert.equal(
    extractText('gemini', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }),
    'ab', 'Gemini splits an answer across parts'
  );
  assert.equal(
    extractText('grok', { choices: [{ message: { content: 'hello' } }] }), 'hello'
  );
});

test('an empty answer says why, rather than looking like an empty shot list', () => {
  /* Gemini refuses by sending a candidate with no parts and a reason beside
     it. Returning "" there would have put an empty box on screen with nothing
     to act on. */
  assert.throws(
    () => extractText('gemini', { candidates: [{ finishReason: 'SAFETY', content: {} }] }),
    /SAFETY/
  );
  assert.throws(() => extractText('grok', { choices: [] }), /nothing back/);
});

test('a fenced answer is unwrapped, and what it cannot show is kept', () => {
  /* Models fence code whatever they are told, and YAML has nowhere to put a
     list of features no screen can show - so the briefing asks for them as
     comments, and they come back out here. */
  const { recipe, unsupported } = recipeFromText(
    '```yaml\n# Not shown: GST reports\n# Not shown: batch-wise stock\nvideo: demo\nshots: []\n```'
  );
  assert.deepEqual(unsupported, ['GST reports', 'batch-wise stock']);
  assert.ok(!recipe.includes('Not shown'));
  assert.match(recipe, /^video: demo/);
});

test('an unfenced answer is left exactly as it is', () => {
  const { recipe } = recipeFromText('video: demo\nshots: []\n');
  assert.match(recipe, /^video: demo/);
});

test('what a provider sends back goes through the studio own validator', () => {
  /* The whole design: another AI's answer is not trusted any further than a
     shot list somebody typed. A made-up screen has to be refused here exactly
     as it would be there. */
  const { recipe } = recipeFromText(`\`\`\`yaml
video: from-gemini
business: { name: Shop }
party: { name: Ravi }
invoice: { number: 1, date: "01/01/2026" }
items: [{ name: X, rate: 10, qty: 1, gst: 5, unit: PCS }]
shots:
  - screen: a-screen-that-does-not-exist
    duration: 3
    actions: []
\`\`\``);
  const { errors } = parse(recipe, catalogue(), { scrollable: scrollables() });
  assert.ok(errors, 'an invented screen must not reach the renderer');
  assert.match(errors.join(' '), /a-screen-that-does-not-exist/);
});

test('every provider says where to get a key and what it costs', () => {
  for (const p of PROVIDERS) {
    assert.ok(p.hint && p.where && p.free, `${p.id} is missing something a person needs`);
    assert.match(p.whereUrl, /^https:\/\//, `${p.id} has no link to its keys`);
    assert.equal(providerById(p.id).id, p.id);
  }
  assert.equal(providerById('nonsense').id, 'anthropic', 'an unknown id falls back to the studio own path');
});

/* A fake localStorage, which is all these need. */
function store(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    seen: map
  };
}

test('each provider keeps its own key, so switching AI switches the key', () => {
  /* The bug: one key under one name. Saving a Gemini key and then picking
     Grok sent the Gemini key to x.ai, which answers "Incorrect API key
     provided" - a true sentence about the wrong problem. */
  const s = store();
  writeKey(s, 'gemini', 'AIzaGEM');
  writeKey(s, 'grok', 'xai-GROK');
  assert.equal(readKey(s, 'gemini'), 'AIzaGEM');
  assert.equal(readKey(s, 'grok'), 'xai-GROK');
  assert.equal(readKey(s, 'anthropic'), '', 'a provider with no key has no key');
  assert.notEqual(keySlotFor('gemini'), keySlotFor('grok'));
});

test('a pasted key is trimmed before it is kept', () => {
  /* It arrives from a clipboard, and a trailing newline in an Authorization
     header is rejected by the browser before it ever reaches the provider. */
  const s = store();
  writeKey(s, 'grok', '  xai-GROK\n');
  assert.equal(readKey(s, 'grok'), 'xai-GROK');
});

test('the one old shared key is filed under whoever it belongs to', () => {
  const s = store({ 'mbb-anthropic-key': 'xai-GROK', 'mbb-ai-provider': 'grok' });
  migrateKey(s);
  assert.equal(readKey(s, 'grok'), 'xai-GROK');
  assert.equal(readKey(s, 'anthropic'), '', 'and not left sitting under Claude');
  assert.equal(s.getItem('mbb-anthropic-key'), null, 'the old slot is emptied');
});

test('an old key of no recognisable shape goes to the AI that was selected', () => {
  const s = store({ 'mbb-anthropic-key': 'plain-token', 'mbb-ai-provider': 'gemini' });
  migrateKey(s);
  assert.equal(readKey(s, 'gemini'), 'plain-token');
});

test('migrating twice does not overwrite a key saved since', () => {
  const s = store({ 'mbb-anthropic-key': 'AIzaOLD' });
  migrateKey(s);
  writeKey(s, 'gemini', 'AIzaNEW');
  migrateKey(s);
  assert.equal(readKey(s, 'gemini'), 'AIzaNEW');
});

test('nothing to migrate is not an error', () => {
  const s = store();
  migrateKey(s);
  assert.equal(readKey(s, 'anthropic'), '');
});

/* Google's own words when it retired the model this studio was asking for. */
const RETIRED = JSON.stringify({
  error: {
    code: 404,
    message: 'This model models/gemini-2.5-flash is no longer available to new users. '
      + 'Please update your code to use models/gemini-3.8-flash for the latest features.',
    status: 'NOT_FOUND'
  }
});

test('a retired model is swapped for the one the provider names', () => {
  /* A model name written into this file goes stale on somebody else's
     schedule, and the people using the studio cannot edit it. */
  assert.equal(replacementModel('gemini-2.5-flash', RETIRED), 'gemini-3.8-flash');
});

test('the dead model named in the refusal is not retried', () => {
  /* The message names both. Picking the first one would ask again for the
     model that was just refused, forever. */
  const named = replacementModel('gemini-2.5-flash', RETIRED);
  assert.notEqual(named, 'gemini-2.5-flash');
});

test('a refusal that is not about a model is left alone', () => {
  assert.equal(replacementModel('grok-4', '{"error":"Incorrect API key provided"}'), null);
  assert.equal(replacementModel('gemini-3.8-flash', ''), null);
  assert.equal(
    replacementModel('gemini-3.8-flash', 'This model models/gemini-3.8-flash is overloaded'),
    null,
    'a refusal naming only the model asked for suggests nothing'
  );
});

test('a retired model is asked again once, and only once', async () => {
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    asked.push(String(url));
    return { ok: false, status: 404, text: async () => RETIRED } as unknown as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(
      askProvider({ id: 'gemini', key: 'AIzaKEY', model: 'gemini-2.5-flash', prompt: 'B' }),
      /404/,
      'a second refusal is reported, not retried again'
    );
    assert.equal(asked.length, 2, 'asked once, then once more with the named model');
    assert.match(asked[1], /gemini-3\.8-flash:generateContent$/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
