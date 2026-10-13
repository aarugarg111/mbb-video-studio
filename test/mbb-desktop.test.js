import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { deviceOf } from '../src/device.js';
import { itemsFor } from '../screens/mbb-desktop-items.js';
import { SCANNED } from '../screens/mbb-desktop-create-invoice.js';

const DESKTOP = ['mbb-desktop-parties', 'mbb-desktop-items', 'mbb-desktop-create-invoice'];

const DATA = {
  business: { name: 'SAGAR SUPERBAZAAR' },
  party: { name: 'ASHOK TRADING CO', balance: 21846 },
  invoice: { number: 5945, date: '08/10/2026' },
  items: [
    { name: 'SUGAR 5KG', rate: 310, qty: 2, gst: 5, unit: 'PKT', purchase: 272, stock: 4 },
    { name: 'TATA SALT 1KG', rate: 28, qty: 6, gst: 5, unit: 'PKT', purchase: 24, stock: 8 }
  ]
};

test('all three render with nothing at all', () => {
  for (const name of DESKTOP) {
    assert.ok(SCREENS[name].render({}, {}).includes('class="screen mbscreen"'), name);
  }
});

test('all three are drawn as a laptop', () => {
  for (const name of DESKTOP) assert.equal(deviceOf(SCREENS[name]), 'desktop', name);
});

test('every target exists on its screen, in some state', () => {
  /* Some targets are state-dependent and should be: "+ Add Item" is there
     while the form is empty and gone once the AI has filled it, which is
     correct - you cannot add a line to a bill that has not been read yet. So
     a target has to exist in SOME state, not in every one. */
  const cat = catalogue();
  const states = [{}, { filled: 1 }, { lowStock: 1 }];
  for (const name of DESKTOP) {
    const rendered = states.map(st => SCREENS[name].render(DATA, st));
    for (const id of cat[name]) {
      assert.ok(
        rendered.some(html => html.includes(`id="${id}"`)),
        `${name}: nothing carries id="${id}" in any state`
      );
    }
  }
});

test('none emits a raw colour or an entity XML cannot read', () => {
  for (const name of DESKTOP) {
    for (const state of [{}, { filled: 1, lowStock: 1 }]) {
      const html = SCREENS[name].render(DATA, state);
      assert.equal(html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/), null, name);
      assert.equal(html.match(/rgba?\(/), null, name);
      for (const [, e] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
        assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(e), `${name}: &${e};`);
      }
    }
  }
});

test('no real phone number reaches a desktop screen', () => {
  /* The desktop recording shows the owner's number under the business name,
     and several more down the Parties table. None of them is reproduced, and
     the sidebar simply leaves the number out. */
  for (const name of DESKTOP) {
    const html = SCREENS[name].render(DATA, { filled: 1 });
    for (const real of ['9599157340', '7566242525', '6265795299']) {
      assert.ok(!html.includes(real), `${name} carries a number from the recording`);
    }
    assert.equal(html.match(/\b[6-9]\d{9}\b/), null, `${name} shows something shaped like a mobile number`);
  }
});

test('Parties totals what it lists, split by who owes whom', () => {
  const html = SCREENS['mbb-desktop-parties'].render(DATA, {});
  assert.ok(html.includes('To Collect'));
  assert.ok(html.includes('To Pay'));
  assert.ok(html.includes('ASHOK TRADING CO'), 'the recipe party leads the table');
  /* Customer and Supplier both appear, or one of the two figures is always 0. */
  assert.ok(html.includes('Customer') && html.includes('Supplier'));
});

test('Items counts what is low from the recipe own stock', () => {
  const html = SCREENS['mbb-desktop-items'].render(DATA, {});
  /* Both recipe items are below the default low level of 10. */
  assert.ok(html.includes('Low Stock'));
  assert.match(html, /Low Stock<\/div>\s*<div class="mb-stat-v">2</);
});

test('tapping Low Stock narrows the table', () => {
  const all = SCREENS['mbb-desktop-items'].render(DATA, {});
  const low = SCREENS['mbb-desktop-items'].render(DATA, { lowStock: 1 });
  assert.ok(all.includes('AMUL RUSK FAMILY PACK'), 'the full table has the fillers');
  assert.ok(!low.includes('AMUL RUSK FAMILY PACK'), 'the narrowed one does not');
  assert.ok(low.includes('SUGAR 5KG'));
});

test('an item list the recipe gives is not padded past seven', () => {
  const many = itemsFor({ items: Array.from({ length: 12 }, (_, i) => ({ name: 'ITEM ' + i, rate: 10, stock: 50 })) });
  assert.equal(many.length, 7);
});

test('the invoice form is empty until the AI reads the bill', () => {
  const before = SCREENS['mbb-desktop-create-invoice'].render(DATA, {});
  const after = SCREENS['mbb-desktop-create-invoice'].render(DATA, { filled: 1 });

  assert.ok(!before.includes('ASHOK TRADING CO'), 'the party is not there yet');
  assert.ok(before.includes('mb-blank'), 'the field is an outline waiting to be filled');
  assert.ok(before.includes('Drag'), 'and the panel is still asking for a bill');

  assert.ok(after.includes('ASHOK TRADING CO'));
  assert.ok(after.includes('SUGAR 5KG'));
  assert.ok(after.includes('Bill read'));
});

test('the totals agree with the lines above them', () => {
  /* 310x2 + 28x6 = 788, and a total that disagreed with its own rows is the
     kind of thing a viewer notices. */
  const html = SCREENS['mbb-desktop-create-invoice'].render(DATA, { filled: 1 });
  assert.ok(html.includes('788'), 'the total is the sum of the lines');
  assert.ok(html.includes('620') && html.includes('168'), 'and the lines are shown');
});

test('the scanned counter does not move between renders', () => {
  /* It is the shop running total, not anything this bill changes - a number
     that drifted would make two renders of one recipe different files. */
  const a = SCREENS['mbb-desktop-create-invoice'].render(DATA, {});
  const b = SCREENS['mbb-desktop-create-invoice'].render(DATA, {});
  assert.equal(a, b);
  assert.ok(a.includes(String(SCANNED)));
});

test('a party name that would break the markup is escaped on all three', () => {
  const nasty = { ...DATA, party: { name: '<script>x</script>', balance: 1 } };
  for (const name of DESKTOP) {
    assert.ok(!SCREENS[name].render(nasty, { filled: 1 }).includes('<script>'), name);
  }
});
