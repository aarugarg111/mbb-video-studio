import { esc } from '../src/esc.js';
import { ledger, short } from './mcf-data.js';

export const name = 'tally-receivables';

/* Tally's Bills Receivable report - the screen the owner is looking at when
 * the script says "Tally mujhe bata deta hai paisa kahan pending hai".
 *
 * NOT SAMPLED. Every other screen in this project was rebuilt from frames of
 * a real recording; there is no recording of Tally, and Tally is somebody
 * else's software. This is approximated from TallyPrime's own documentation -
 * the top key bar, the right-hand function panel, and the report's real
 * columns (Date, Ref. No., Party's Name, Pending Amount, Due on, Overdue by
 * days) - and is meant to be recognisable rather than exact, which is what was
 * asked for. If a recording ever arrives, rebuild it from that.
 *
 * It is also drawn in portrait rather than at a desktop's proportions. A
 * landscape window shrunk into a 390-wide frame puts the text at about four
 * pixels and nobody can read it; in a clip that is on screen for two seconds,
 * legible beats geometrically honest.
 *
 * The figures come from the SAME ledger myCashFlo reads, because the whole
 * point of the script is that the two agree. If Tally showed one total and
 * myCashFlo another, the ad would argue with itself.
 *
 * Coordinates MEASURED.
 */
export const targets = {
  'f6-age-wise': { x: 347, y: 166 },
  'f12-configure': { x: 347, y: 216 },
  'bill-row-0': { x: 152, y: 120 }
};

const TOP_KEYS = [
  ['K', 'Company'], ['Y', 'Data'], ['Z', 'Exchange'], ['G', 'Go To'],
  ['O', 'Import'], ['E', 'Export'], ['M', 'E-mail'], ['P', 'Print']
];

const SIDE_KEYS = [
  ['F2', 'Period'], ['F3', 'Company'], ['F4', 'Ledger'],
  ['F6', 'Age-wise'], ['F7', 'Bill-wise'], ['F12', 'Configure']
];

/* Tally lists BILLS, not people: one party can owe across several invoices,
 * and a report with one line per party would read as a ledger instead. Large
 * balances are split in two, which also fills the sheet the way a real
 * report does. The split is exact - the second bill is the remainder - so the
 * grand total still equals the book myCashFlo reads. */
export function billsOf(parties) {
  const out = [];
  for (const p of parties) {
    if (p.balance >= 900000) {
      const first = Math.round(p.balance * 0.6);
      out.push({ ...p, amount: first, age: p.overdueDays });
      out.push({ ...p, amount: p.balance - first, age: Math.max(p.overdueDays - 26, 0) });
    } else {
      out.push({ ...p, amount: p.balance, age: p.overdueDays });
    }
  }
  return out;
}

/* Tally writes dates as 1-Apr-26. Derived from how overdue the bill is, so
 * the date column and the overdue column agree with each other. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function tallyDate(daysAgo) {
  /* Counted back from a fixed day rather than from today: a render has to be
   * reproducible, and "97 days ago" moving overnight would make two renders of
   * the same recipe different files. */
  const base = Date.UTC(2026, 9, 10);
  const d = new Date(base - Number(daysAgo || 0) * 86400000);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}

/* Tally prints full rupees with Indian grouping and two decimals. */
export function tallyAmount(n) {
  const v = Math.round(Math.abs(Number(n) || 0));
  const s = String(v);
  const grouped = s.length <= 3
    ? s
    : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  return grouped + '.00';
}

export function render(data, state) {
  const book = ledger(data);
  const company = data?.business?.name || 'Your Business';
  const bills = billsOf(book.parties).slice(0, 9);

  const row = (b, i) => `
    <div class="ty-row" ${i === 0 ? 'id="bill-row-0"' : ''}>
      <div class="ty-c date">${tallyDate(b.age + 30)}</div>
      <div class="ty-c party">${esc(b.name)}</div>
      <div class="ty-c amt">${tallyAmount(b.amount)}</div>
      <div class="ty-c due">${tallyDate(b.age)}</div>
      <div class="ty-c late">${b.age > 0 ? b.age : ''}</div>
    </div>`;

  return `
<div class="screen tyscreen">
  <div class="ty-top">
    ${TOP_KEYS.map(([k, label]) =>
      `<span class="ty-key"><b>${k}</b>: ${label}</span>`).join('')}
  </div>

  <div class="ty-sub">
    <span class="ty-co">${esc(company)}</span>
    <span class="ty-rep">Bills Receivable</span>
  </div>

  <div class="ty-main">
    <div class="ty-sheet">
      <div class="ty-head">
        <div class="ty-c date">Date</div>
        <div class="ty-c party">Party&#39;s Name</div>
        <div class="ty-c amt">Pending Amount</div>
        <div class="ty-c due">Due on</div>
        <div class="ty-c late">Overdue<br/>by days</div>
      </div>

      <div class="ty-rows">${bills.map(row).join('')}</div>

      <div class="ty-row total">
        <div class="ty-c date"></div>
        <div class="ty-c party">Grand Total</div>
        <div class="ty-c amt">${tallyAmount(book.outstanding)}</div>
        <div class="ty-c due"></div>
        <div class="ty-c late"></div>
      </div>
    </div>

    <div class="ty-side">
      ${SIDE_KEYS.map(([k, label]) => `
        <div class="ty-sidekey" ${k === 'F6' ? 'id="f6-age-wise"' : k === 'F12' ? 'id="f12-configure"' : ''}>
          <b>${k}</b>: ${label}
        </div>`).join('')}
    </div>
  </div>

  <div class="ty-status">
    <span>${esc(company)}</span>
    <span>${bills.length} bills &#183; ${short(book.outstanding)} pending</span>
  </div>
</div>`;
}
