import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';

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

/* This screen's list can be scrolled. A day of sixty bills shows six at a
 * time, and until this existed there was no way to film the rest of them. */
export const scrolls = true;

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
/* The day the range lands on when it is narrowed to today. Every bill on the
 * list is then dated it: a range reading "Today" over bills from three
 * different days is a screen contradicting itself, and the longer the list
 * got the more of them you could see at once.
 *
 * Which day it is comes from the recipe's own bill, not from here. It used to
 * be the fixed 13 Oct, and a recipe whose bill was dated 22/10 put "13 Oct"
 * on the row and "22/10/2026" on the bill that row opened - a bill made nine
 * days after the day it is filed under. The day the list is showing is the
 * day the bill was written. */
const FALLBACK_DAY = { short: '13 Oct', long: '13 Oct 2026', year: 2026 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayOf(data) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(data?.invoice?.date ?? '').trim());
  if (!m) return FALLBACK_DAY;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return FALLBACK_DAY;
  const short = `${Number(m[1])} ${month}`;
  return { short, long: `${short} ${m[3]}`, year: Number(m[3]) };
}

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

  /* What the recipe's own bill actually comes to. The top row IS that bill,
   * so this is the figure it has to show. */
  const own = summarise(data?.items ?? []).total;

  /* The newest row is the recipe's own bill, not an invented one.
   *
   * It was invented, and it showed. A script that opens a customer's bill
   * taps the top row, and the top row read "Cash Sale - 925 - Paid" while the
   * bill that opened read MEENA BEAUTY PARLOUR and a different total. A
   * viewer takes in both in one breath. The row a script taps is the bill it
   * opens, so it carries that bill's name, number and amount; the invented
   * history starts below it.
   *
   * Only when the recipe names a customer. A stall that bills nobody by name
   * has no bill to look up, and marking its newest row unpaid produced "Cash
   * Sale - Unpaid - 1 day(s) overdue", which is a row arguing with itself.
   *
   * A recipe can say so by leaving the party out or by writing it as "Cash
   * Sale" outright, which the momos stall does - both mean nobody's name is
   * on this bill. */
  const named = Boolean(data?.party?.name)
    && String(data.party.name).trim().toLowerCase() !== 'cash sale';

  const mine = b => (!named ? b : {
    ...b,
    party,
    amount: own > 0 ? own : b.amount,
    /* Unpaid, because looking an old bill up is how a shopkeeper answers
     * "kitna baaki hai" - and because the bill it opens says outstanding
     * until somebody records the payment on camera. */
    paid: false,
    /* Not overdue: it was written today. Unpaid is the whole of the story. */
    overdue: 0,
    /* Its own date, so the row and the bill it opens agree. */
    when: dayOf(data).short
  });

  const bills = DAY.map((s, i) => ({
    ...s,
    no: first - i,
    /* Most counter sales are cash sales; the recipe's party shows up on the
     * ones that are not, which is how the real list reads. */
    party: i % 3 === 2 ? party : 'Cash Sale',
    amount: s.qty * rate
  })).map((b, i) => (i === 0 ? mine(b) : b));

  /* A script that says the day took a particular amount gets that amount.
   *
   * It gets it by having sold MORE, not by having sold dearer. Scaling the
   * eight bills up to the figure was the obvious way and it is wrong: a stall
   * selling 60-rupee plates of momos would have shown bills of two thousand
   * rupees each, which is a number no one at that stall has ever written. The
   * amount on a bill is what somebody actually bought, so it stays a sensible
   * multiple of the price, and a bigger day is simply a longer day's worth of
   * them.
   *
   * The list shows the most recent of those, which is what a transaction list
   * is: the visible rows are not meant to add up to the day, any more than
   * they do in the real app. */
  const asked = Number(data?.sales?.dayTotal);
  let total = bills.reduce((t, b) => t + b.amount, 0);

  if (Number.isFinite(asked) && asked > 0 && rate > 0) {
    const wanted = [];
    let running = 0;
    for (let i = 0; running < asked; i++) {
      const base = DAY[i % DAY.length];
      /* The last bill is trimmed to land exactly on the figure, down to one
       * plate - a day that ends on a part-plate would be a lie about what was
       * sold. */
      const left = asked - running;
      const qty = Math.min(base.qty, Math.max(1, Math.round(left / rate)));
      const amount = qty * rate;
      wanted.push({ ...base, qty, amount });
      running += amount;
      if (wanted.length > 400) break;
    }

    /* Whatever rounding is left over rides on the newest bill, so the day
     * totals exactly what the script said. */
    const drift = asked - wanted.reduce((t, b) => t + b.amount, 0);
    if (wanted.length && drift !== 0) wanted[0].amount += drift;

    bills.length = 0;
    /* Newest first, numbered down from the recipe's own invoice number. */
    /* Enough rows that scrolling has somewhere to go. Six fit on screen; a
     * day of sixty bills that ran dry after eight would make the scroll look
     * like the end of the day rather than the middle of it. */
    wanted.slice(0, 24).forEach((b, i) => {
      const row = { ...b, no: first - i, party: i % 3 === 2 ? party : 'Cash Sale' };
      bills.push(i === 0 ? mine(row) : row);
    });
    total = asked;
  }


  return {
    rate,
    cost,
    bills,
    /* The whole day's units, not the visible rows': the Profit & Loss costs
     * the stock that was sold, and only a fraction of a long day's bills fit
     * on one screen. Counting what is on screen would have had the report
     * buying stock for eight bills and selling it for sixty. */
    units: total > 0 && rate > 0 ? Math.round(total / rate) : bills.reduce((t, b) => t + b.qty, 0),
    total
  };
}

export function render(data, state) {
  const day = salesOf(data);
  const today = Number(state?.today ?? 0) > 0;
  const on = dayOf(data);
  /* How far the thumb has pushed the list up, from the timeline. */
  const scroll = Math.max(0, Number(state?.scroll ?? 0));

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
        <!-- Nothing written today is overdue. Narrowing the range to Today
             redates every row to today, and the ones carrying an overdue note
             then read "22 Oct - 1 day(s) overdue" under a header saying the
             day IS 22 Oct. The note belongs to the older dates it came
             with. -->
        <div class="sl-when">${esc(today ? on.short : b.when)}${b.overdue && !today ? `<span class="sl-dot">&#183;</span><span class="sl-late">${b.overdue} day(s) overdue</span>` : ''}</div>
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
    <span class="sl-range-v">${today ? on.long : `${on.short} ${on.year - 1} - ${on.long}`}</span>
    <span class="sl-change" id="change-range">CHANGE</span>
  </div>

  <div class="sl-scroll">
    <div class="sl-list" style="transform: translateY(${(-scroll).toFixed(1)}px)">${day.bills.map(card).join('')}</div>
  </div>

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
