import test from 'node:test';
import assert from 'node:assert/strict';
import { salesOf } from '../screens/sales-list.js';
import { summarise } from '../src/money.js';
import { invoiceOf, todayStamp } from '../src/invoice.js';
import { readdirSync, readFileSync } from 'node:fs';

/* The row a script taps is the bill that opens.
 *
 * It was not. The top row of the sales list was an invented cash sale, and
 * tapping it opened the recipe's own bill - so a clip read "Cash Sale,
 * Rs 925, Paid" on the row and "MEENA BEAUTY PARLOUR, Rs 1,155, outstanding"
 * on the bill one cut later. Nothing failed; the renders were green and the
 * contradiction was only visible to somebody watching.
 *
 * Every screen here draws the same bill, so the row standing for it has to
 * carry the same four things a viewer can read off both. */
const DATA = {
  business: { name: 'SHREE BEAUTY COLLECTION' },
  party: { name: 'MEENA BEAUTY PARLOUR', phone: '98765 43210' },
  invoice: { number: 2187, date: '22/10/2026' },
  items: [
    { name: 'FACEWASH 100ML', rate: 185, qty: 3, gst: 18, unit: 'PCS', purchase: 142 },
    { name: 'NAIL PAINT', rate: 120, qty: 5, gst: 18, unit: 'PCS', purchase: 88 }
  ]
};

test('the top row of the list is the recipe own bill', () => {
  const [row] = salesOf(DATA).bills;
  assert.equal(row.party, 'MEENA BEAUTY PARLOUR', 'the row names the customer whose bill it is');
  assert.equal(row.no, 2187, 'and carries that bill invoice number');
  assert.equal(row.amount, summarise(DATA.items).total, 'and that bill total, to the rupee');
});

test('the row is dated the day the bill was written', () => {
  /* A row reading "13 Oct" over a bill reading 22/10/2026 files a bill nine
   * days before it existed. The list shows the day of the bill it holds. */
  const [row] = salesOf(DATA).bills;
  assert.equal(row.when, '22 Oct');
});

test('the row says outstanding, which is what the bill it opens says', () => {
  /* bill-open prints "<total> outstanding" until a payment is recorded on
   * camera. A row marked Paid above it would contradict it on sight. */
  const [row] = salesOf(DATA).bills;
  assert.equal(row.paid, false);
});

test('the rest of the list is still invented, and is not the bill', () => {
  /* The guard must not have turned the whole day into copies of one bill -
   * a list of eight identical rows is not a day's trading. */
  const { bills } = salesOf(DATA);
  const same = bills.slice(1).filter(b => b.no === 2187);
  assert.equal(same.length, 0, 'no other row claims this bill number');
  assert.ok(bills.length > 1, 'there is a day behind the bill');
});

test('a bill with no items does not wipe the row amount', () => {
  /* summarise([]) is 0, and a row reading Rs 0 would be worse than the
   * invented figure it replaced. */
  const [row] = salesOf({ ...DATA, items: [] }).bills;
  assert.ok(row.amount > 0, `the row showed ${row.amount}`);
});

test('a bill with no date falls back rather than printing nonsense', () => {
  const [row] = salesOf({ ...DATA, invoice: { number: 2187 } }).bills;
  assert.match(row.when, /^\d{1,2} [A-Z][a-z]{2}$/, `the row showed "${row.when}"`);
});

test('a counter sale with nobody name on it keeps an invented top row', () => {
  /* A stall that bills nobody has no bill to look up. Marking its newest row
   * unpaid gave "Cash Sale - Unpaid - 1 day(s) overdue": a cash sale that is
   * somehow in arrears. A recipe says so by leaving the party out, or by
   * naming it "Cash Sale" outright, which the momos stall does. */
  for (const party of [undefined, { name: 'Cash Sale' }, { name: 'cash sale' }]) {
    const [row] = salesOf({ ...DATA, party }).bills;
    assert.equal(row.paid, true, `${JSON.stringify(party)} produced an unpaid cash sale`);
    assert.equal(row.party, 'Cash Sale');
    assert.ok(!row.overdue, 'and nothing is overdue on it');
  }
});

test('asking the day for a figure still lands on that figure exactly', () => {
  /* The top row stopped being an invented amount, and the day is built by
   * adding invented amounts up. The figure a script asks for is the one
   * number on these screens a viewer can check against the script. */
  const asked = 10570;
  const day = salesOf({ ...DATA, party: { name: 'Cash Sale' }, sales: { dayTotal: asked } });
  assert.equal(day.total, asked);
});

test('a bill with no date stated is dated today', () => {
  /* Noticed on a finished clip: bills were coming out dated weeks earlier,
   * because the default was a fixed 01/01/2026 and every recipe pinned an
   * October date of its own. A bill carries the day it was written. */
  const { date } = invoiceOf({ ...DATA, invoice: { number: 2187 } });
  assert.equal(date, todayStamp());
  assert.match(date, /^\d{2}\/\d{2}\/\d{4}$/, `got "${date}"`);
});

test('a date the script does state is left alone', () => {
  assert.equal(invoiceOf(DATA).date, '22/10/2026');
});

test('the stamp pads the day and month, the way the app prints them', () => {
  assert.equal(todayStamp(new Date(2026, 0, 5)), '05/01/2026');
  assert.equal(todayStamp(new Date(2026, 11, 25)), '25/12/2026');
});

test('no recipe pins a date, so every clip bills today', () => {
  /* The pinned dates are gone; this is what stops them creeping back one
   * recipe at a time. A script that genuinely needs a date says so in the
   * shot list, and this test is the place to record why. */
  const dir = new URL('../recipes/', import.meta.url);
  for (const f of readdirSync(dir).filter(n => n.endsWith('.yaml'))) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/^\s*date:/m.test(text), `${f} pins an invoice date`);
  }
});
