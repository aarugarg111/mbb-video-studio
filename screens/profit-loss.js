import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { salesOf } from './sales-list.js';

export const name = 'profit-loss';

/* The Profit and Loss report (reference/frames/rep-24.png): what came in, what
 * went out, and what was actually earned.
 *
 * This is the screen a "kitna kamaaya" script should end on, and it is a
 * formal report rather than the dashboard card I first invented - Particulars
 * and Amount, with Gross Profit and Net Profit on their own shaded rows. The
 * rows and their order are the app's own.
 *
 * The real report prints the owner's phone number under the business name.
 * It is left out: the recording's is a real number.
 */

/* Coordinates are in 390x844 space and are MEASURED. */
export const targets = {
  'change-range': { x: 349, y: 74 },
  'pdf': { x: 329, y: 28 },
  'excel': { x: 364, y: 28 },
  'net-profit': { x: 349, y: 571 }
};

/* The app prints these to one decimal, even when they are whole. */
export function amount(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return v.toFixed(1);
}

/* Every figure comes from the bills on the sales list, so the two screens
 * agree: a report that disagreed with the list it summarises would be the
 * fastest way to lose a viewer. */
export function profitAndLoss(data) {
  const day = salesOf(data);
  const sale = day.total;

  /* A script that says what the shop cleared gets that figure - and the rest
   * of the report is made to agree with it rather than left contradicting it.
   * This report is four numbers in a column where each one is the one above
   * minus the one below: state the last and the purchase has to move, or the
   * screen shows a subtraction that does not work.
   *
   * salesOf has already honoured a stated day total, so "sale" here is
   * whatever the script asked for, and the purchase follows from both. */
  const asked = Number(data?.sales?.netProfit);
  const purchase = Number.isFinite(asked) && asked >= 0
    ? Math.max(0, sale - asked)
    : day.units * day.cost;
  const gross = sale - purchase;

  return {
    sale,
    purchase,
    gross,
    /* The report has rows for these and a small shop has nothing in them;
     * showing zeroes is what the real one does. */
    otherIncome: 0,
    indirect: 0,
    net: gross
  };
}

export function render(data, state) {
  const pl = profitAndLoss(data);
  const business = data?.business?.name || 'Your Business';

  const row = (label, value, kind = '') => `
    <div class="pl-row ${kind}">
      <div class="pl-k">${esc(label)}</div>
      <div class="pl-v">${esc(amount(value))}</div>
    </div>`;

  return `
<div class="screen plscreen">
  <div class="topbar">
    <span class="ico">${icons.back(20)}</span>
    <div class="ttl">Profit and Loss</div>
    <span class="ico pl-pdf" id="pdf">${icons.pdfFile(19)}</span>
    <span class="ico pl-xls" id="excel">${icons.ledger(19)}</span>
  </div>

  <div class="pl-range">
    <span class="ico">${icons.calendar(17)}</span>
    <span class="pl-range-k">This week</span>
    <span class="pl-range-v">12 Oct 2026 - 18 Oct 2026</span>
    <span class="pl-change" id="change-range">CHANGE</span>
  </div>

  <div class="pl-head">
    <div class="pl-biz">${esc(business)}</div>
    <div class="pl-report">Profit &amp; Loss Report</div>
  </div>

  <div class="pl-rule"></div>
  <div class="pl-duration">Duration : 12/10/2026 - 18/10/2026</div>

  <div class="pl-table">
    <div class="pl-row head">
      <div class="pl-k">Particulars</div>
      <div class="pl-v">Amount</div>
    </div>
    ${row('Sale(+)', pl.sale)}
    ${row('Cr. Note /Sale Return(-)', 0)}
    ${row('Purchase(-)', pl.purchase)}
    ${row('Dr. Note/ Purchase Return(+)', 0)}
    ${row('Tax Payable(-)', 0)}
    ${row('Tax Receivable (+)', 0)}
    ${row('Opening Stock (-)', 0)}
    ${row('Closing Stock (+)', 0)}
    ${row('Gross Profit', pl.gross, 'total')}
    ${row('Other Income(+)', pl.otherIncome)}
    ${row('Indirect Expenses (-)', pl.indirect)}
    <div class="pl-row total">
      <div class="pl-k">Net Profit</div>
      <!-- The id is on the FIGURE: a zoom should frame the number, not the
           empty middle of a full-width row. -->
      <div class="pl-v" id="net-profit">${esc(amount(pl.net))}</div>
    </div>
  </div>
</div>`;
}
