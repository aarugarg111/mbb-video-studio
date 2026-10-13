import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawColoursIn } from '../src/colour-guard.js';
import { SCREENS, catalogue } from '../screens/index.js';
import { salesOf } from '../screens/sales-list.js';
import { profitAndLoss, amount } from '../screens/profit-loss.js';

const BOTH = ['sales-list', 'profit-loss'];
const DATA = {
  business: { name: 'JHANVI MOMOS CORNER' },
  invoice: { number: 108 },
  items: [{ name: 'VEG MOMOS PLATE', rate: 60, purchase: 26, unit: 'PLATE' }]
};

test('both render with nothing at all', () => {
  for (const n of BOTH) assert.ok(SCREENS[n].render({}, {}).includes('class="screen'), n);
});

test('both are in the catalogue with targets that exist', () => {
  const cat = catalogue();
  for (const n of BOTH) {
    const html = SCREENS[n].render(DATA, { today: 1 });
    for (const id of cat[n]) assert.ok(html.includes(`id="${id}"`), `${n}: no id="${id}"`);
  }
});

test('neither emits a raw colour or an entity XML cannot read', () => {
  for (const n of BOTH) {
    for (const st of [{}, { today: 1 }]) {
      const html = SCREENS[n].render(DATA, st);
      assert.deepEqual(rawColoursIn(html), [], n);
      for (const [, e] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
        assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(e), `${n}: &${e};`);
      }
    }
  }
});

test('the invented screen is gone', () => {
  /* day-sales showed a purple total-and-profit card that the app does not
     have. Replacing it was the fix; leaving it would have meant an ad could
     still show something that does not exist. */
  assert.equal(SCREENS['day-sales'], undefined);
  assert.ok(!Object.keys(catalogue()).includes('day-sales'));
});

test('no real phone number reaches either screen', () => {
  /* The Profit and Loss report prints the owner's number under the business
     name. The recording's is real, so it is left out. */
  for (const n of BOTH) {
    const html = SCREENS[n].render(DATA, {});
    assert.ok(!html.includes('9599157340'), n);
    assert.equal(html.match(/\b[6-9]\d{9}\b/), null, n);
  }
});

test('the sales list carries no total, because the real one does not', () => {
  /* This is what the invented screen got wrong. */
  const html = SCREENS['sales-list'].render(DATA, {});
  assert.ok(!/TODAY.S SALES/i.test(html));
  assert.ok(!html.includes('Profit'));
});

test('the list shows what was paid and what was not', () => {
  const html = SCREENS['sales-list'].render(DATA, {});
  assert.ok(html.includes('Paid'));
  assert.ok(html.includes('Unpaid'));
  /* An unpaid bill is the only one that offers a way to chase it. */
  assert.ok(html.includes('Record Manually'));
  assert.ok(html.includes('Share Payment Link'));
});

test('changing the range narrows it to today', () => {
  const before = SCREENS['sales-list'].render(DATA, {});
  const after = SCREENS['sales-list'].render(DATA, { today: 1 });
  assert.ok(before.includes('Last 365 Days'));
  assert.ok(after.includes('Today'));
  assert.ok(!after.includes('Last 365 Days'));
});

test('the report totals the same bills the list shows', () => {
  /* A report that disagreed with the list it summarises is the fastest way to
     lose a viewer, and the two shots run back to back. */
  const day = salesOf(DATA);
  const pl = profitAndLoss(DATA);
  assert.equal(pl.sale, day.total);
  assert.equal(pl.purchase, day.units * day.cost);
  assert.equal(pl.gross, pl.sale - pl.purchase);
  assert.equal(pl.net, pl.gross);
});

test('the figures are the ones the momos script needs', () => {
  const pl = profitAndLoss(DATA);
  assert.equal(pl.sale, 1560);
  assert.equal(pl.purchase, 676);
  assert.equal(pl.net, 884);
  assert.ok(pl.net < pl.sale, 'profit can never exceed the takings');
});

test('amounts are printed to one decimal, as the app prints them', () => {
  assert.equal(amount(1560), '1560.0');
  assert.equal(amount(0), '0.0');
  assert.equal(amount(884.25), '884.3');
});

test('a shop with no purchase price still shows an honest margin', () => {
  const pl = profitAndLoss({ items: [{ name: 'SAMOSA', rate: 20 }] });
  assert.ok(pl.purchase > 0, 'a cost is assumed rather than a profit invented');
  assert.ok(pl.net > 0 && pl.net < pl.sale);
});

test('both are pure functions of the recipe, so two renders match', () => {
  for (const n of BOTH) {
    assert.equal(SCREENS[n].render(DATA, {}), SCREENS[n].render(DATA, {}));
  }
});

test('a shop name that would break the markup is escaped', () => {
  const nasty = { business: { name: '<script>x</script>' }, items: [{ name: 'X', rate: 5 }] };
  for (const n of BOTH) assert.ok(!SCREENS[n].render(nasty, {}).includes('<script>'), n);
});
