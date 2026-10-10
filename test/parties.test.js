import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { partyRows } from '../screens/parties.js';

const DATA = {
  business: { name: 'Balaji Trading Co' },
  party: { name: 'Rakesh Kumar', balance: 6259 },
  items: [{ name: 'Sugar 5kg', rate: 310, qty: 2 }]
};

test('parties is registered and in the catalogue', () => {
  assert.ok(SCREENS.parties, 'parties should be registered');
  assert.ok(catalogue().parties.includes('create-party'));
});

test('parties renders with no data at all', () => {
  const html = SCREENS.parties.render({}, {});
  assert.match(html, /Parties/);
  assert.match(html, /Create Party/);
});

test("the recipe's own party leads the list", () => {
  /* The point of the screen in a video is to show the customer the script is
   * about, not a stranger from the filler list. */
  const rows = partyRows(DATA);
  assert.equal(rows[0].name, 'Rakesh Kumar');
  assert.equal(rows[0].balance, 6259);
});

test('the list is filled out when the recipe names nobody', () => {
  const rows = partyRows({});
  assert.ok(rows.length >= 5, 'a half-empty list does not look like the app');
  assert.ok(rows.every(r => r.name));
});

test('the list runs past the bottom of the screen, as the app does', () => {
  /* Five rows left a visible band of empty page below them; the real screen
   * always has rows disappearing under the button row. */
  assert.ok(partyRows(DATA).length >= 7);
});

test('balances are grouped the Indian way', () => {
  const html = SCREENS.parties.render(DATA, {});
  assert.match(html, /₹ 6,259/);
  assert.match(html, /₹ 2,58,369/, 'lakhs group as 2,58,369 not 258,369');
});

test('every row offers a WhatsApp reminder', () => {
  const html = SCREENS.parties.render(DATA, {});
  const rows = partyRows(DATA).length;
  assert.equal(html.split('Send Reminder').length - 1, rows);
});

test('each party is labelled Customer or Supplier', () => {
  for (const r of partyRows(DATA)) {
    assert.ok(['Customer', 'Supplier'].includes(r.kind), `${r.name} has kind ${r.kind}`);
  }
});

test('Parties is the selected tab', () => {
  const html = SCREENS.parties.render(DATA, {});
  assert.match(html, /<div class="on"><span class="ico">[\s\S]*?<\/span>Parties<\/div>/);
});

test('tap targets are inside the screen and were measured, not guessed', () => {
  for (const [id, t] of Object.entries(SCREENS.parties.targets)) {
    assert.ok(t.x > 0 && t.x < 390, `${id} x out of range`);
    assert.ok(t.y > 0 && t.y < 844, `${id} y out of range`);
  }
  /* Measured values; an estimate here was 55px out before it was measured. */
  assert.deepEqual(SCREENS.parties.targets['party-row-0'], { x: 195, y: 240 });
  assert.deepEqual(SCREENS.parties.targets['create-party'], { x: 299, y: 743 });
});

test('every tap target exists in the rendered markup', () => {
  const html = SCREENS.parties.render(DATA, {});
  for (const id of Object.keys(SCREENS.parties.targets)) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} has coordinates but no element`);
  }
});

test('no real contact from the reference recording appears', () => {
  /* The recording is of a real shop. Its parties are not in this code. */
  const html = SCREENS.parties.render({}, {}).toLowerCase();
  for (const real of ['sweet mishra', 'ashok polithin', 'yadav 202', 'dheeraj raj', 'aryan enterprises']) {
    assert.ok(!html.includes(real), `${real} came from the recording and must not be here`);
  }
  assert.doesNotMatch(html, /\+91 ?[0-9]/, 'no phone numbers on this screen');
});

test('parties uses tokens, never raw hex colours', () => {
  assert.doesNotMatch(SCREENS.parties.render(DATA, {}), /#[0-9a-fA-F]{6}/);
});
