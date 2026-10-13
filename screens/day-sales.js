import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';

export const name = 'day-sales';

/* A day's takings: every sale made today, what they add up to, and what was
 * actually earned on them.
 *
 * This is the screen a whole genre of script ends on - "poore din ki mehnat ke
 * baad humne kitne paise kamaaye?" - and the studio had nothing for it. The
 * clip could show a bill being made and never show the day adding up, which
 * is the payoff the video is built around.
 *
 * The reveal is the point, so it is timed: the figure counts up from zero over
 * the first second and a half rather than being on screen before the viewer
 * has read the question. Pure in t, so two renders match.
 */

/* Coordinates are in 390x844 space and are MEASURED. */
export const targets = {
  'today': { x: 46, y: 81 },
  'sale-row-0': { x: 195, y: 364 },
  'profit': { x: 195, y: 271 },
  'download': { x: 329, y: 28 }
};

export const COUNT_SECONDS = 1.5;

/* Eases out, so it slows as it lands rather than stopping dead. */
export function revealed(total, t) {
  const elapsed = Math.max(0, Number(t) || 0);
  if (elapsed >= COUNT_SECONDS) return total;
  const p = elapsed / COUNT_SECONDS;
  return Math.round(total * (1 - Math.pow(1 - p, 3)));
}

/* A day of a small stall: many small sales rather than a few big ones. Each
 * sale is a number of plates at a price, so the total and the profit are both
 * arithmetic on what is listed rather than figures asserted on screen.
 *
 * Times are fixed, not derived from the clock: a render has to be
 * reproducible, and a list that reordered itself overnight would make two
 * renders of one recipe different files. */
const DAY = [
  { at: '11:40 AM', qty: 2, mode: 'Cash' },
  { at: '12:15 PM', qty: 3, mode: 'UPI' },
  { at: '1:05 PM', qty: 1, mode: 'Cash' },
  { at: '2:30 PM', qty: 4, mode: 'UPI' },
  { at: '4:10 PM', qty: 2, mode: 'Cash' },
  { at: '5:45 PM', qty: 6, mode: 'UPI' },
  { at: '6:20 PM', qty: 3, mode: 'Cash' },
  { at: '7:35 PM', qty: 5, mode: 'UPI' }
];

/* What the stall sells, and what it costs to make. The recipe's first item
 * leads if it has one, so a momo stall shows momos and a chai stall chai. */
export function dayOf(data) {
  const item = (data?.items ?? [])[0];
  const name = item?.name || 'MOMOS PLATE';
  const rate = Number(item?.rate ?? 60);
  /* Without a purchase price there is no honest profit to show, so a sensible
   * margin is assumed and the screen says it is a margin, not a fact. */
  const cost = Number(item?.purchase ?? Math.round(rate * 0.45));

  const sales = DAY.map((s, i) => ({
    ...s,
    no: 100 + i + 1,
    name,
    amount: s.qty * rate,
    earned: s.qty * (rate - cost)
  }));

  return {
    name,
    rate,
    cost,
    sales,
    plates: sales.reduce((t, s) => t + s.qty, 0),
    total: sales.reduce((t, s) => t + s.amount, 0),
    profit: sales.reduce((t, s) => t + s.earned, 0)
  };
}

export function render(data, state) {
  const day = dayOf(data);
  const t = Number(state?.t ?? 0);
  const total = revealed(day.total, t);
  const profit = revealed(day.profit, t);

  const row = (s, i) => `
    <div class="ds-row" ${i === 0 ? 'id="sale-row-0"' : ''}>
      <div class="ds-when">${esc(s.at)}</div>
      <div class="ds-what">
        <div class="ds-nm">${esc(s.name)}</div>
        <div class="ds-sub">${s.qty} &#215; ${formatINR(day.rate)} &#183; ${esc(s.mode)}</div>
      </div>
      <div class="ds-amt">${formatINR(s.amount)}</div>
    </div>`;

  return `
<div class="screen dsscreen">
  <div class="topbar">
    <div class="ttl">Sales</div>
    <span class="ico" id="download">${icons.download(19)}</span>
    <span class="ico">${icons.more(19)}</span>
  </div>

  <div class="ds-days">
    <div class="ds-day on" id="today">Today</div>
    <div class="ds-day">This Week</div>
    <div class="ds-day">This Month</div>
  </div>

  <div class="ds-hero">
    <div class="ds-hero-k">TODAY&#8217;S SALES</div>
    <div class="ds-hero-v">${formatINR(total)}</div>
    <div class="ds-hero-s">${day.sales.length} bills &#183; ${day.plates} plates</div>
  </div>

  <div class="ds-split" id="profit">
    <div class="ds-half">
      <div class="ds-half-k">Profit</div>
      <div class="ds-half-v up">${formatINR(profit)}</div>
    </div>
    <div class="ds-half">
      <div class="ds-half-k">Received</div>
      <div class="ds-half-v">${formatINR(total)}</div>
    </div>
  </div>

  <div class="ds-list-k">TODAY&#8217;S BILLS</div>
  <div class="ds-list">${day.sales.map(row).join('')}</div>
</div>`;
}
