import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { ledger } from '../screens/mcf-data.js';
import { billsOf, tallyAmount, tallyDate } from '../screens/tally-receivables.js';

const DATA = {
  business: { name: 'SHREE BALAJI BUILDING MATERIALS' },
  party: { name: 'AGRAWAL CONSTRUCTIONS', balance: 1400000, overdueDays: 68 },
  cashflo: {
    parties: [
      { name: 'SHANTI INFRA PROJECTS', balance: 1150000, overdueDays: 94 },
      { name: 'Sunil Traders', balance: 370000, overdueDays: 9 }
    ]
  }
};

test('it renders with nothing at all', () => {
  const html = SCREENS['tally-receivables'].render({}, {});
  assert.ok(html.includes('Bills Receivable'));
});

test('it is in the catalogue and its targets exist', () => {
  const cat = catalogue();
  const html = SCREENS['tally-receivables'].render(DATA, {});
  for (const id of cat['tally-receivables']) {
    assert.ok(html.includes(`id="${id}"`), `nothing carries id="${id}"`);
  }
});

test('it emits no raw colour and no entity XML cannot read', () => {
  const html = SCREENS['tally-receivables'].render(DATA, {});
  assert.equal(html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/), null);
  assert.equal(html.match(/rgba?\(/), null);
  for (const [, e] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
    assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(e), `&${e}; is not an XML entity`);
  }
});

test('Tally and myCashFlo show the same money', () => {
  /* The whole point of the script is that the two agree. If this report
     totalled anything other than the book myCashFlo reads, the ad would
     contradict itself between two consecutive shots. */
  const book = ledger(DATA);
  const bills = billsOf(book.parties);
  const summed = bills.reduce((t, b) => t + b.amount, 0);
  assert.equal(summed, book.outstanding);
  assert.ok(SCREENS['tally-receivables'].render(DATA, {}).includes(tallyAmount(book.outstanding)));
});

test('a big balance is split across bills, and the split is exact', () => {
  const bills = billsOf([{ name: 'BIG', balance: 1400000, overdueDays: 68 }]);
  assert.equal(bills.length, 2, 'a large balance reads as several invoices, as Tally lists bills');
  assert.equal(bills[0].amount + bills[1].amount, 1400000, 'the split must not lose a rupee');
  assert.ok(bills[1].age < bills[0].age, 'the later bill is less overdue');
});

test('a small balance stays one bill', () => {
  const bills = billsOf([{ name: 'SMALL', balance: 370000, overdueDays: 9 }]);
  assert.equal(bills.length, 1);
  assert.equal(bills[0].amount, 370000);
});

test('money is written the way Tally writes it', () => {
  assert.equal(tallyAmount(5200000), '52,00,000.00');
  assert.equal(tallyAmount(840000), '8,40,000.00');
  assert.equal(tallyAmount(500), '500.00');
  assert.equal(tallyAmount(0), '0.00');
});

test('dates are fixed, so two renders of one recipe are the same file', () => {
  assert.equal(tallyDate(0), tallyDate(0));
  assert.match(tallyDate(30), /^\d{1,2}-[A-Z][a-z]{2}-\d{2}$/);
  assert.notEqual(tallyDate(0), tallyDate(60));
});

test('an overdue bill shows its days and a current one does not', () => {
  const html = SCREENS['tally-receivables'].render(DATA, {});
  assert.ok(html.includes('>94<'), 'the oldest bill shows how late it is');
  const current = SCREENS['tally-receivables'].render(
    { cashflo: { parties: [{ name: 'ON TIME', balance: 1000, overdueDays: 0 }] } }, {});
  assert.ok(current.includes('class="ty-c late"></div>'), 'a bill that is not late shows nothing');
});

test('a party name that would break the markup is escaped', () => {
  const html = SCREENS['tally-receivables'].render(
    { cashflo: { parties: [{ name: '<script>alert(1)</script>', balance: 100 }] } }, {});
  assert.ok(!html.includes('<script>'));
});

test('Tally belongs with myCashFlo and never with myBillBook', async () => {
  const { parse } = await import('../src/recipe.js');
  const clip = shots => parse(
    ['video: t', 'shots:', ...shots.map(s => `  - { screen: ${s}, duration: 2 }`)].join('\n'),
    catalogue(), {});

  const withMcf = clip(['tally-receivables', 'mcf-tally', 'mcf-parties']);
  assert.ok(!withMcf.warnings.some(w => w.includes('mixes')), 'Tally handing over to myCashFlo is the script');

  const withMbb = clip(['tally-receivables', 'home']);
  assert.ok(withMbb.warnings.some(w => w.includes('mixes')), 'Tally in a billing clip is the wrong footage');
});
