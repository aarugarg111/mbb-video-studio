import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { profitAndLoss } from './profit-loss.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-reports';

/* The Profit and Loss report on a laptop.
 *
 * The first version of this screen carried a disclosure saying no recording
 * of it existed and that it should be replaced the moment one did. One does
 * now (Reports MBB Desktop), and this is the replacement. What the recording
 * showed, and what the invented version had wrong:
 *
 *   - It is a REPORT OPENED FROM A LIST, not a page of its own. The header is
 *     a back arrow, the report's full name - "Profit And Loss Report" - and a
 *     Favourite chip with a star, where the invented one had a page title.
 *   - The range control names a PERIOD - This Week, Previous Month, Current
 *     Fiscal Year - and opens a menu of them. The invented one printed a pair
 *     of dates, which is the phone's control, not the laptop's.
 *   - The buttons are Email Excel, Download Excel and Print PDF, each with
 *     its icon AFTER the label. The invented one had "PDF" and "Excel", and
 *     missed that the report can be mailed at all.
 *   - There is ONE table - Particulars and Amount - and no Net Profit card.
 *     The invented screen split the rows into Income and Expenditure and put
 *     the figure in a big panel on the right, which is a dashboard's way of
 *     showing a number. The real report ends on a Net Profit ROW.
 *   - Twelve rows, in the app's order, including the tax and stock lines the
 *     invented version left out. A row with nothing in it prints a dash.
 *
 * Still different from the recording, on purpose: the recording is in the
 * app's DARK skin, because that is what the account it was made on is set to.
 * Every screen in the studio is drawn LIGHT and stays that way - asked and
 * settled, not a guess. Recordings will keep arriving dark, since they come
 * off that account; that is not a reason to re-skin anything. Match the
 * LAYOUT of a recording, never its theme.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/reports/show?report_type=profit_and_loss';

/* Where the camera rests: the table, which is the whole of this screen. */
export const focus = { x: 400, y: 215 };

/* The periods the range menu offers, in the app's order. */
const RANGES = [
  'Last 7 days', 'This Month', 'Previous Month', 'Last 30 Days',
  'This Quarter', 'Previous Quarter', 'Current Fiscal Year'
];

/* The row tapped in the menu. Previous Month is what a "last month's profit"
 * script asks for, and it is the row the recording lands on. */
const PICKED = 'Previous Month';

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'create-sales-invoice': { x: 63, y: 45 },
  'change-range': { x: 184, y: 50 },
  'email-excel': { x: 484, y: 50 },
  'excel': { x: 580, y: 50 },
  'print-pdf': { x: 671, y: 50 },
  'net-profit': { x: 461, y: 381 },
  'pick-range': { x: 182, y: 124 }
};

/* Tapping the range control opens the menu; picking a period closes it and
 * re-reads the report for that period. */
export const tapEffects = {
  'change-range': { ranging: 1 },
  'pick-range': { ranging: 0, ranged: 1 }
};

/* Picking a period closes the menu the row is in, so the ring has to land
 * before the menu goes. Without this the tap would shut the menu on the same
 * frame the ring appears, and the footage would show a finger pressing the
 * table underneath. */
export const dismisses = ['pick-range'];

/* The report prints a dash where there is nothing, not a zero. */
const cell = n => (Number(n) ? formatINR(n) : '-');

export function render(data, state) {
  const pl = profitAndLoss(data);
  const ranging = Number(state?.ranging ?? 0) > 0;
  const ranged = Number(state?.ranged ?? 0) > 0;
  const period = ranged ? PICKED : 'This Week';

  /* The id goes on the FIGURE, not on the row: a row is the width of the
   * table and a ring drawn in the middle of one lands in the gap between the
   * name and the number. */
  const row = (label, value, kind = '', id) => `
    <div class="rep-row ${kind}">
      <span class="rep-k">${esc(label)}</span>
      <span class="rep-v">${id ? `<span id="${id}">${cell(value)}</span>` : cell(value)}</span>
    </div>`;

  const tool = (label, icon, id) => `
    <div class="rep-tool" id="${id}">${esc(label)}<span class="ico">${icons[icon](9)}</span></div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Reports', null)}

  <div class="mb-main">
    <div class="mb-top">
      <span class="ico rep-back">${icons.back(13)}</span>
      <div class="mb-title sm">Profit And Loss Report</div>
      <div class="rep-fav"><span class="ico">${icons.star(10)}</span>Favourite</div>
    </div>

    <div class="mb-bar">
      <div class="rep-range">
        <div class="mb-select" id="change-range">
          <span class="ico">${icons.calendar(10)}</span>${esc(period)}
          <span class="ico mb-chev">${icons.chevDown(9)}</span>
        </div>
        ${ranging ? `
        <div class="rep-menu">
          ${RANGES.map(r => `
            <div class="rep-opt${r === PICKED ? ' on' : ''}"><span${r === PICKED ? ' id="pick-range"' : ''}>${esc(r)}</span></div>`).join('')}
        </div>` : ''}
      </div>

      <div class="rep-tools">
        ${tool('Email Excel', 'mail', 'email-excel')}
        ${tool('Download Excel', 'chevDown', 'excel')}
        ${tool('Print PDF', 'print', 'print-pdf')}
      </div>
    </div>

    <div class="rep-sheet">
      <div class="rep-row head">
        <span class="rep-k">PARTICULARS</span><span class="rep-v">AMOUNT</span>
      </div>
      ${row('Sale(+)', pl.sale)}
      ${row('Cr. Note/Sale Return(-)', 0)}
      ${row('Purchase(-)', pl.purchase)}
      ${row('Dr. Note/Purchase Return(+)', 0)}
      ${row('Tax Payable(-)', 0)}
      ${row('Tax Receivable(+)', 0)}
      ${row('Opening Stock(-)', 0)}
      ${row('Closing Stock(+)', 0)}
      ${row('Gross Profit', pl.gross, 'strong')}
      ${row('Other Income(+)', pl.otherIncome)}
      ${row('Indirect Expenses(-)', pl.indirect)}
      ${row('Net Profit', pl.net, 'strong', 'net-profit')}
    </div>
  </div>
</div>`;
}
