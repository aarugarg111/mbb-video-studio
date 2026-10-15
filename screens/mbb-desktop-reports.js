import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { profitAndLoss } from './profit-loss.js';
import { sidebar, topActions } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-reports';

/* Profit and Loss on a laptop - the same report as the phone's, in the laptop
 * interface. The figures come from profitAndLoss(), the SAME function the
 * phone's report calls, so the two cannot disagree about what a day made.
 *
 * DISCLOSED: no frame of this page exists in the recordings. The rail, the
 * toolbar and the table are the app's own language as every other laptop
 * screen here uses it, and the report's own rows are the phone's. It looks
 * right; it may not be right. Replace it the moment a recording of the laptop
 * Reports page exists.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/reports/profit_and_loss';

export const focus = { x: 423, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'create-sales-invoice': { x: 63, y: 45 },
  'change-range': { x: 216, y: 56 },
  'net-profit': { x: 596, y: 236 },
  'excel': { x: 619, y: 23 }
};

export function render(data, state) {
  const pl = profitAndLoss(data);

  const row = (label, value, kind = '', id) => `
    <div class="rep-row ${kind}" ${id ? `id="${id}"` : ''}>
      <span>${esc(label)}</span><span>${formatINR(value)}</span>
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Reports', null)}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Profit &amp; Loss</div>
      ${topActions([
        { label: 'PDF', icon: 'download', kind: 'ghost' },
        { label: 'Excel', icon: 'download', kind: 'ghost', id: 'excel' }
      ])}
    </div>

    <div class="mb-bar">
      <div class="mb-select" id="change-range">
        <span class="ico">${icons.calendar(10)}</span>12 Oct 2026 - 18 Oct 2026
        <span class="ico mb-chev">${icons.chevDown(9)}</span>
      </div>
    </div>

    <div class="rep-body">
      <div class="rep-table">
        <div class="rep-head">Income</div>
        ${row('Sale', pl.sale)}
        ${row('Other Income', pl.otherIncome)}
        <div class="rep-head">Expenditure</div>
        ${row('Purchase', pl.purchase)}
        ${row('Indirect Expenses', pl.indirect)}
        <div class="rep-rule"></div>
        ${row('Gross Profit', pl.gross, 'strong')}
      </div>

      <div class="rep-hero" id="net-profit">
        <div class="rep-hero-k">Net Profit</div>
        <div class="rep-hero-v">${formatINR(pl.net)}</div>
        <div class="rep-hero-s">12 Oct 2026 - 18 Oct 2026</div>
      </div>
    </div>
  </div>
</div>`;
}
