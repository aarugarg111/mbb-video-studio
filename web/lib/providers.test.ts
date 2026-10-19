import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/recipe.js';
import { catalogue, scrollables } from '../../screens/index.js';
import {
  PROVIDERS, providerById, providerOfKey, buildRequest, extractText, recipeFromText
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
  const gem = buildRequest('gemini', 'AIzaKEY', 'gemini-2.5-flash', 'BRIEFING');
  assert.match(gem.url, /generativelanguage\.googleapis\.com/);
  assert.match(gem.url, /gemini-2\.5-flash:generateContent$/);
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
