import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawColoursIn } from '../src/colour-guard.js';
import { SCREENS, catalogue } from '../screens/index.js';
import { deviceOf } from '../src/device.js';
import { itemsFor } from '../screens/items.js';
import { SCANNED } from '../screens/mbb-desktop-chrome.js';

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
    assert.ok(/class="screen mbscreen/.test(SCREENS[name].render({}, {})), name);
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
  /* The item catalogue's own rows only exist while it is open, which is why
     "picker" is one of the states here: without it, half the billing flow's
     targets look unreachable. */
  const states = [{}, { filled: 1 }, { lowStock: 1 }, { picker: 1 }, { picker: 1, items: [1, 1] }];
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
      assert.deepEqual(rawColoursIn(html), [], name);
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

test('the shelf is longer than the window, because it scrolls now', () => {
  /* This used to stop at six, on the grounds that a row past the bottom of a
     16:9 window runs under the Pending Actions pill. Having more than fits is
     the point of being able to scroll it: the list is clipped by its own box
     and the rest is reached by scrolling, rather than cut off at the edge of
     what one screenful holds.

     Both shapes read the same shelf, so one business cannot be stocking two
     different catalogues. */
  const many = itemsFor({ items: Array.from({ length: 12 }, (_, i) => ({ name: 'ITEM ' + i, rate: 10, stock: 50 })) });
  assert.ok(many.length > 6, `only ${many.length} rows - nothing to scroll`);

  for (const screen of ['items', 'mbb-desktop-items']) {
    assert.equal(SCREENS[screen].scrolls, true, `${screen} should scroll`);
    /* How far it goes is the screen's own business - a list stops at its last
       row - so this asks only that asking it to move moves it. */
    const moved = SCREENS[screen].render(DATA, { scroll: 60 });
    const by = Number((moved.match(/translateY\((-?[\d.]+)px\)/) ?? [])[1]);
    assert.ok(by < 0, `${screen} did not move`);
  }
});

test('the bill is empty until items are put on it', () => {
  /* Billing on a laptop is the phone's flow in another interface: the form
     opens with the party on it and no lines, the catalogue puts the lines on,
     and only then does the bill come to anything. */
  const empty = SCREENS['mbb-desktop-create-invoice'].render(DATA, {});
  assert.ok(!empty.includes('SUGAR 5KG'), 'no line is on the bill yet');
  assert.ok(empty.includes('+ Add Item'), 'and the way to add one is on screen');
  assert.ok(!empty.includes('Add to Bill [F7]'), 'the catalogue is not open');

  const open = SCREENS['mbb-desktop-create-invoice'].render(DATA, { picker: 1 });
  assert.ok(open.includes('Add to Bill [F7]'), 'tapping + Add Item opens the catalogue');
  assert.ok(open.includes('SUGAR 5KG'), 'which lists what the shop sells');

  const picked = SCREENS['mbb-desktop-create-invoice'].render(DATA, { picker: 1, items: [1, 1] });
  assert.ok(picked.includes('Show 2 Item(s) Selected'), picked.slice(0, 200));

  const onBill = SCREENS['mbb-desktop-create-invoice'].render(DATA, { items: [1, 1] });
  assert.ok(!onBill.includes('Add to Bill [F7]'), 'the catalogue closes behind them');
  assert.ok(onBill.includes('SUGAR 5KG'), 'and the lines are on the bill');
});

test('Mira AI fills the same bill the other way round', () => {
  const after = SCREENS['mbb-desktop-create-invoice'].render(DATA, { filled: 1 });
  assert.ok(after.includes('SUGAR 5KG'));
  assert.ok(after.includes('Bill read'));
  assert.ok(SCREENS['mbb-desktop-create-invoice'].render(DATA, {}).includes('Drag'),
    'and asks for a document until it has one');
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
