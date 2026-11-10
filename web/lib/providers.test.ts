import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/recipe.js';
import { catalogue, scrollables } from '../../screens/index.js';
import {
  PROVIDERS, providerById, providerOfKey, buildRequest, extractText, recipeFromText,
  readKey, writeKey, migrateKey, keySlotFor, replacementModel, askProvider,
  objectsToThinking, castToShape
} from './providers';

test('a key is recognised by its shape, and nothing else is guessed at', () => {
  assert.equal(providerOfKey('AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxx'), 'gemini');
  assert.equal(providerOfKey('  AIzaWithSpaces  '), 'gemini', 'a pasted key brings whitespace');
  /* Keys from the AIs the studio no longer uses must NOT be recognised as
     Gemini ones. Somebody pasting an old Claude key needs to be told it is
     the wrong key, not have it sent to Google and answered with
     "unauthorised" - a true sentence about the wrong problem. */
  assert.equal(providerOfKey('sk-ant-api03-xxxx'), null);
  assert.equal(providerOfKey('xai-abcdefghijklmnop'), null);
  assert.equal(providerOfKey('hello'), null);
});

test('gemini is asked in the shape it expects', () => {
  const gem = buildRequest('gemini', 'AIzaKEY', 'gemini-3.8-flash', 'BRIEFING');
  assert.match(gem.url, /generativelanguage\.googleapis\.com/);
  assert.match(gem.url, /gemini-3.8-flash:generateContent$/);
  /* The key goes in a header, never in the URL: a URL ends up in logs,
     history and referrers. */
  assert.equal(gem.headers['x-goog-api-key'], 'AIzaKEY');
  assert.ok(!gem.url.includes('AIzaKEY'), 'the key is in the address bar');
  assert.match(JSON.parse(gem.body).contents[0].parts[0].text, /BRIEFING/);
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
});

test('an empty answer says why, rather than looking like an empty shot list', () => {
  /* Gemini refuses by sending a candidate with no parts and a reason beside
     it. Returning "" there would have put an empty box on screen with nothing
     to act on. */
  assert.throws(
    () => extractText('gemini', { candidates: [{ finishReason: 'SAFETY', content: {} }] }),
    /SAFETY/
  );
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
  /* First in the list IS the default - providerById falls back to it and the
   * picker opens on it - and the default has to be the free one. The studio's
   * entire running cost is the single call this chooses the provider for, so
   * a change that quietly puts a paid model back in front should fail here
   * before anybody finds it on a bill. */
  assert.equal(
    providerById('nonsense').id, 'gemini',
    'an unknown id falls back to the first provider, which must be the free one'
  );
  assert.equal(PROVIDERS[0].id, 'gemini', 'the studio opens on the free provider');
});

test('the gemini call asks for as little thinking as the model allows', () => {
  const body = JSON.parse(buildRequest('gemini', 'AIza-x', 'gemini-3.5-flash-lite', 'hi').body);
  assert.equal(
    body.generationConfig.thinkingConfig.thinkingLevel, 'minimal',
    'Flash models think by default, and this job does not need it'
  );

  /* Dropped on request, because the setting is an optimisation and never a
     requirement - a slower clip beats no clip. */
  const plain = JSON.parse(
    buildRequest('gemini', 'AIza-x', 'gemini-3.5-flash-lite', 'hi', { withoutThinking: true }).body
  );
  assert.equal(plain.generationConfig.thinkingConfig, undefined);
  assert.equal(plain.generationConfig.temperature, 0.2, 'only the thinking setting is dropped');
});

test('only a complaint about thinking makes the studio drop it and retry', () => {
  assert.ok(objectsToThinking('Invalid JSON payload received. Unknown name "thinkingLevel"'));
  assert.ok(objectsToThinking('thinking_level is not supported for this model'));
  assert.ok(objectsToThinking('generationConfig.thinkingConfig: unsupported'));
  /* A bad key that retried itself would fail twice and report the second. */
  assert.ok(!objectsToThinking('API key not valid. Please pass a valid API key.'));
  assert.ok(!objectsToThinking('Quota exceeded for this project.'));
});

test('team mode sends the gemini call to the worker, and the key stays there', () => {
  const direct = buildRequest('gemini', 'AIza-secret', 'gemini-3.5-flash-lite', 'hi');
  assert.match(direct.url, /^https:\/\/generativelanguage\.googleapis\.com\//);
  assert.equal(direct.headers['x-goog-api-key'], 'AIza-secret');

  const team = buildRequest('gemini', '', 'gemini-3.5-flash-lite', 'hi', { baseUrl: 'https://studio.example' });
  assert.equal(team.url, 'https://studio.example/api/gemini/v1beta/models/gemini-3.5-flash-lite:generateContent');
  /* The whole point of team mode: the browser never holds a key, so it must
     not be sending an empty one either. */
  assert.ok(!('x-goog-api-key' in team.headers), 'the browser must not send a key header in team mode');
  assert.equal(JSON.parse(team.body).generationConfig.thinkingConfig.thinkingLevel, 'minimal');
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

test('a key is kept in a slot named after its provider', () => {
  /* The bug this fixed: one key under one name, so saving a key for one AI
     and then picking another sent the first one's key onward - answered with
     "Incorrect API key provided", a true sentence about the wrong problem.
     There is one provider now, but the slot stays NAMED after it rather than
     being collapsed to a single box: bringing a second provider back should
     not bring that bug back with it. */
  const s = store();
  writeKey(s, 'gemini', 'AIzaGEM');
  assert.equal(readKey(s, 'gemini'), 'AIzaGEM');
  assert.match(keySlotFor('gemini'), /gemini/, 'the slot names its provider');
});

test('a pasted key is trimmed before it is kept', () => {
  /* It arrives from a clipboard, and a trailing newline in a header is
     rejected by the browser before it ever reaches the provider. */
  const s = store();
  writeKey(s, 'gemini', '  AIzaGEM\n');
  assert.equal(readKey(s, 'gemini'), 'AIzaGEM');
});

test('the one old shared key is filed under whoever it belongs to', () => {
  const s = store({ 'mbb-anthropic-key': 'AIzaOLD', 'mbb-ai-provider': 'gemini' });
  migrateKey(s);
  assert.equal(readKey(s, 'gemini'), 'AIzaOLD');
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
  assert.equal(readKey(s, 'gemini'), '');
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

/* Measuring the free tier turned up one 500 in five calls. The studio made a
 * single attempt, so a fault that had already passed still cost somebody
 * their clip - and for Customer Support that is somebody on the phone to a
 * customer at the time. */
test('a provider having a bad minute is asked again, once', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1
      ? { ok: false, status: 503, text: async () => 'overloaded' } as unknown as Response
      : {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'video: t\nshots: []\n' }] } }] })
        } as unknown as Response;
  }) as typeof fetch;

  try {
    const { recipe } = await askProvider({ id: 'gemini', key: 'AIzaKEY', model: 'm', prompt: 'B' });
    assert.equal(calls, 2, 'the second try is what the viewer gets');
    assert.match(recipe, /video: t/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a provider down for the minute is reported, not retried forever', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 500, text: async () => 'internal' } as unknown as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(askProvider({ id: 'gemini', key: 'AIzaKEY', model: 'm', prompt: 'B' }), /try again/i);
    assert.equal(calls, 2, 'twice, then it says so');
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* A key that is wrong is wrong the second time too, and asking again only
 * makes somebody wait longer to be told. */
test('a rejected key is not waited on and asked again', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 400, text: async () => 'API key not valid' } as unknown as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(askProvider({ id: 'gemini', key: 'bad', model: 'm', prompt: 'B' }), /accept the key/);
    assert.equal(calls, 1, 'asked once');
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* castToShape took over the job the Claude path used to do: APPLYING the
 * shape rather than merely asking for it in the briefing. The failure it
 * exists for is documented - a shot list comes back on phone screens
 * whatever the picker said, because the script's own "Internal team adds:
 * UI" markers name phone screens and the model follows the script. */
test('a phone shot list asked for as a laptop one comes back on laptop screens', () => {
  const phone = 'video: t\nshots:\n  - screen: home\n    duration: 2\n';
  const { recipe } = castToShape(phone, 'laptop');
  assert.match(recipe, /mbb-desktop-dashboard/, 'the laptop screen stands in for home');
  assert.ok(!/screen: home/.test(recipe), 'and the phone one is gone');
});

test('a shot list with no shape asked for is left exactly as it came', () => {
  const asWritten = 'video: t\nshots:\n  - screen: home\n    duration: 2\n';
  assert.equal(castToShape(asWritten, '').recipe, asWritten);
  assert.equal(castToShape(asWritten, undefined).recipe, asWritten);
});

test('something it cannot read is passed on untouched, not thrown away', () => {
  /* The validator one step later reports a broken recipe far better than
     this could, and a recipe this cannot read is exactly the one somebody
     needs to see rather than have silently replaced. */
  const broken = 'video: t\n  shots: [[[\n';
  assert.equal(castToShape(broken, 'laptop').recipe, broken);
  assert.deepEqual(castToShape(broken, 'laptop').unsupported, []);

  const noShots = 'video: t\n';
  assert.equal(castToShape(noShots, 'laptop').recipe, noShots);
});
