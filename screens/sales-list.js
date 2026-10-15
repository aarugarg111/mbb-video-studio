import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';

export const name = 'sales-list';

/* The list of sales (reference/frames/rep-8.png): every bill made, newest
 * first, with what was paid and what was not.
 *
 * This replaces a screen I invented. The first version of "today's takings"
 * was a purple hero card with a total and a profit on it, which is not what
 * the app shows and not something a viewer would ever see - Aryan caught it.
 * This one is rebuilt from the recording: filter pills, a date range you can
 * change, and a card per bill. There is no total on it, because there is no
 * total on the real screen.
 */

/* Coordinates are in 390x844 space and are MEASURED. */
export const targets = {
  'change-range': { x: 349, y: 134 },
  'sort': { x: 336, y: 36 },
  'filter-sales': { x: 92, y: 85 },
  'bill-row-0': { x: 195, y: 211 },
  'share-link': { x: 295, y: 482 },
  'received-payment': { x: 97, y: 781 },
  'new-bill': { x: 299, y: 781 }
};

/* Narrowing the range to today is the beat a day-in-the-life script wants. */
export const tapEffects = { 'change-range': { today: 1 } };

const FILTERS = ['All', 'Sales', 'Received Payment', 'Sales Return', 'Credit Note'];

/* The bar across the bottom of every myBillBook screen. */
const NAV = [
  ['Dashboard', 'navDashboard'], ['Parties', 'navParties'], ['Items', 'navItems'],
  ['For You', 'navForYou'], ['More', 'navMore']
];

/* A day of trading. Fixed rather than read off a clock, so two renders of one
 * recipe are the same file. Quantities vary the way a real day does.
 *
 * The real list prints a DATE under each bill, not a clock time
 * (reference/frames/rep-8.png, rep-11.png), and an unpaid bill carries
 * "N day(s) overdue" beside that date. An earlier version printed times, which
 * no myBillBook screen does.
 */
const DAY = [
  { qty: 5, paid: true, when: '13 Oct' },
  { qty: 3, paid: true, when: '13 Oct' },
  { qty: 6, paid: false, when: '12 Oct', overdue: 1 },
  { qty: 2, paid: true, when: '12 Oct' },
  { qty: 4, paid: true, when: '11 Oct' },
  { qty: 1, paid: true, when: '11 Oct' },
  { qty: 3, paid: true, when: '10 Oct' },
  { qty: 2, paid: true, when: '10 Oct' }
];

/* What the shop sells, and therefore what every bill on this list is for. */
export function salesOf(data) {
  const item = (data?.items ?? [])[0];
  const rate = Number(item?.rate ?? 60);
  const cost = Number(item?.purchase ?? Math.round(rate * 0.45));
  const first = Number(data?.invoice?.number ?? 101);
  const party = data?.party?.name || 'Cash Sale';

  const bills = DAY.map((s, i) => ({
    ...s,
    no: first - i,
    /* Most counter sales are cash sales; the recipe's party shows up on the
     * ones that are not, which is how the real list reads. */
    party: i % 3 === 2 ? party : 'Cash Sale',
    amount: s.qty * rate
  }));

  return {
    rate,
    cost,
    bills,
    units: bills.reduce((t, b) => t + b.qty, 0),
    total: bills.reduce((t, b) => t + b.amount, 0)
  };
}

export function render(data, state) {
  const day = salesOf(data);
  const today = Number(state?.today ?? 0) > 0;

  const card = (b, i) => `
    <div class="sl-card" ${i === 0 ? 'id="bill-row-0"' : ''}>
      <div class="sl-top">
        <div class="sl-party">${esc(b.party)}</div>
      </div>
      <div class="sl-mid">
        <div class="sl-inv">Sales Invoice #${b.no}</div>
        <div class="sl-amt">${formatINR(b.amount)}</div>
      </div>
      <div class="sl-bot">
        <div class="sl-when">${esc(b.when)}${b.overdue ? `<span class="sl-dot">&#183;</span><span class="sl-late">${b.overdue} day(s) overdue</span>` : ''}</div>
        <span class="sl-pill ${b.paid ? 'paid' : 'unpaid'}">${b.paid ? 'Paid' : 'Unpaid'}</span>
      </div>
      ${b.paid ? '' : `
        <div class="sl-actions">
          <span class="sl-act">${icons.rupeeCircle(15)}Record Manually</span>
          <span class="sl-act paylink" ${i === 2 ? 'id="share-link"' : ''}>${icons.whatsapp(15)}Share Payment Link</span>
        </div>`}
    </div>`;

  return `
<div class="screen slscreen">
  <div class="sl-search">
    <span class="ico">${icons.search(18)}</span>Search party or invoice no.
    <span class="sl-sort" id="sort">${icons.sliders(14)}SORT</span>
  </div>

  <div class="sl-filters">
    ${FILTERS.map((f, i) => `
      <div class="sl-filter ${i === 1 ? 'on' : ''}" ${i === 1 ? 'id="filter-sales"' : ''}>${esc(f)}</div>`).join('')}
  </div>

  <div class="sl-range">
    <span class="ico">${icons.calendar(17)}</span>
    <span class="sl-range-k">${today ? 'Today' : 'Last 365 Days'}</span>
    <span class="sl-range-v">${today ? '13 Oct 2026' : '13 Oct 2025 - 13 Oct 2026'}</span>
    <span class="sl-change" id="change-range">CHANGE</span>
  </div>

  <div class="sl-list">${day.bills.map(card).join('')}</div>

  <div class="floatbtns">
    <div class="fb dark" id="received-payment">Received Payment</div>
    <div class="fb round green"><span class="ico">${icons.plus(20)}</span></div>
    <div class="fb create" id="new-bill">+ Bill / Invoice</div>
  </div>

  <div class="tabnav">
    ${NAV.map(([label, ic], i) => `
      <div class="${i === 0 ? 'on' : ''}"><span class="ico">${icons[ic](22)}</span>${label}</div>`).join('')}
  </div>
</div>`;
}
