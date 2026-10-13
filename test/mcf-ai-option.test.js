import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { ringPulse } from '../screens/mcf-ai-ringing.js';

const NEW = 'mcf-new-automation';
const RING = 'mcf-ai-ringing';
const BOTH = [NEW, RING];

const DATA = {
  business: { name: 'SHREE BALAJI BUILDING MATERIALS' },
  party: { name: 'AGRAWAL CONSTRUCTIONS', balance: 1400000, overdueDays: 68 },
  cashflo: { parties: [{ name: 'SHANTI INFRA PROJECTS', balance: 1150000, overdueDays: 94 }] }
};

test('both render with nothing at all', () => {
  for (const name of BOTH) assert.ok(SCREENS[name].render({}, {}).includes('class="screen'), name);
});

test('both are in the catalogue with targets that exist', () => {
  const cat = catalogue();
  for (const name of BOTH) {
    const html = SCREENS[name].render(DATA, { t: 1 });
    for (const id of cat[name]) assert.ok(html.includes(`id="${id}"`), `${name}: no id="${id}"`);
  }
});

test('neither emits a raw colour or an entity XML cannot read', () => {
  for (const name of BOTH) {
    for (const state of [{}, { t: 2, channel: 'whatsapp', on: 1 }]) {
      const html = SCREENS[name].render(DATA, state);
      assert.equal(html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/), null, name);
      assert.equal(html.match(/rgba?\(/), null, name);
      for (const [, e] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
        assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(e), `${name}: &${e};`);
      }
    }
  }
});

test('the AI is the option already chosen', () => {
  /* It is what the product is for, and a clip that had to tap it first would
     spend a second of a forty-second ad saying so. */
  const html = SCREENS[NEW].render(DATA, {});
  assert.match(html, /id="channel-ai"[^>]*|class="mcf-opt on" id="channel-ai"/);
  assert.ok(html.includes('AI Call'));
  assert.ok(html.includes('Recommended'));
  const aiRow = html.slice(html.indexOf('channel-ai') - 60, html.indexOf('channel-ai'));
  assert.ok(aiRow.includes('on'), 'the AI row is the selected one');
});

test('choosing another channel moves the selection off the AI', () => {
  const whatsapp = SCREENS[NEW].render(DATA, { channel: 'whatsapp' });
  const atAi = whatsapp.slice(whatsapp.indexOf('channel-ai') - 60, whatsapp.indexOf('channel-ai'));
  const atWa = whatsapp.slice(whatsapp.indexOf('channel-whatsapp') - 60, whatsapp.indexOf('channel-whatsapp'));
  assert.ok(!atAi.includes('mcf-opt on'), 'the AI is no longer selected');
  assert.ok(atWa.includes('mcf-opt on'), 'WhatsApp is');
});

test('every channel is one a tap can actually choose', () => {
  const effects = SCREENS[NEW].tapEffects;
  assert.deepEqual(effects['channel-ai'], { channel: 'ai' });
  assert.deepEqual(effects['channel-whatsapp'], { channel: 'whatsapp' });
  assert.deepEqual(effects['channel-sms'], { channel: 'sms' });
});

test('turning it on changes the screen, or the tap means nothing', () => {
  const before = SCREENS[NEW].render(DATA, {});
  const after = SCREENS[NEW].render(DATA, { on: 1 });
  assert.ok(before.includes('Turn on Automation'));
  assert.ok(after.includes('Automation is on'));
  assert.ok(!before.includes('Automation on &#183;'));
  assert.ok(after.includes('Automation on &#183;'));
});

test('the number of parties comes from the book, not from the air', () => {
  const html = SCREENS[NEW].render(DATA, { on: 1 });
  /* Both parties in DATA are overdue. */
  assert.ok(html.includes('2 parties'), html.slice(html.indexOf('to chase') - 60, html.indexOf('to chase')));
});

test('one party reads as a party, not as 1 parties', () => {
  /* A book the recipe names in full, so no invented filler pads the count. */
  const html = SCREENS[NEW].render(
    { cashflo: { parties: [{ name: 'ONE PARTY', balance: 100, overdueDays: 5 }] } }, {});
  assert.ok(html.includes('1 party to chase'), 'counts are written in English');
});

test('the ringing screen says who is calling and for whom', () => {
  const html = SCREENS[RING].render(DATA, { t: 1 });
  assert.ok(html.includes('myCashFlo AI'), 'the party must be able to tell who is ringing');
  assert.ok(html.includes('SHREE BALAJI BUILDING MATERIALS'), 'and on whose behalf');
  assert.ok(html.includes('AGRAWAL CONSTRUCTIONS'));
  assert.ok(html.includes('Incoming call'));
});

test('the ring is a pure function of time, so two renders match', () => {
  assert.equal(ringPulse(0), ringPulse(0));
  /* Floating point: sin(pi) and sin(3pi) are both zero to any purpose a
     render has, and exactly equal to neither. */
  assert.ok(Math.abs(ringPulse(1) - ringPulse(3)) < 1e-9, 'it repeats on a steady beat');
  assert.ok(ringPulse(0.5) > 0.9, 'and reaches full between beats');
  assert.equal(ringPulse(undefined), 0);
  for (const t of [0, 0.3, 1.7, 9]) {
    const p = ringPulse(t);
    assert.ok(p >= 0 && p <= 1, `the pulse stays within bounds at ${t}`);
  }
});

test('the ringing screen has no bottom bar - it is a phone call', () => {
  assert.ok(!SCREENS[RING].render(DATA, { t: 1 }).includes('mcf-nav'));
});

test('a party name that would break the markup is escaped on both', () => {
  const nasty = { party: { name: '<script>alert(1)</script>', balance: 100, overdueDays: 2 } };
  for (const name of BOTH) assert.ok(!SCREENS[name].render(nasty, { t: 1 }).includes('<script>'), name);
});
