import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { salesOf } from './sales-list.js';
import { sidebar, topActions, pendingActions } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-sales-list';

/* Sales Invoices on a laptop (reference/frames/dsk-mbb-14.png) - the same
 * screen as the phone's sales list, which is the whole idea: a laptop clip is
 * the phone's flow in another interface. What the wider screen buys is that
 * the day's bills come with their dates, numbers, parties, amounts and status
 * in one row each, instead of a card apiece.
 *
 * The day itself is salesOf() - the same day the phone's list shows and the
 * Profit and Loss report adds up - so the three screens cannot disagree about
 * what was sold.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/vouchers/sales_invoice';

export const focus = { x: 423, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  /* "new-bill" is what the phone's own sales list calls this button, so a
   * recipe recast from one shape to the other keeps the beat. The rail's
   * button keeps its own name; two elements cannot share an id. */
  'new-bill': { x: 656, y: 118 },
  'create-sales-invoice': { x: 63, y: 45 },
  'bill-row-0': { x: 423, y: 186 },
  'change-range': { x: 215, y: 118 },
  'total-sales': { x: 207, y: 70 }
};

/* What fits above the floating pill in a 16:9 window. */
const ROWS = 6;

export function render(data, state) {
  const day = salesOf(data);
  const rows = day.bills.slice(0, ROWS);
  const paid = day.bills.filter(b => b.paid).reduce((t, b) => t + b.amount, 0);
  const unpaid = day.total - paid;

  const card = (label, value, kind, id) => `
    <div class="mb-stat ${kind}" ${id ? `id="${id}"` : ''}>
      <div class="mb-stat-k"><span class="ico">${icons.docSettings(10)}</span>${esc(label)}</div>
      <div class="mb-stat-v">${value}</div>
    </div>`;

  const row = (b, i) => `
    <div class="mb-row" ${i === 0 ? 'id="bill-row-0"' : ''}>
      <div class="mb-c date">${esc(b.when)} 2026</div>
      <div class="mb-c no">${b.no}</div>
      <div class="mb-c nm">${esc(b.party)}</div>
      <div class="mb-c due">${b.overdue ? b.overdue + 'd' : '-'}</div>
      <div class="mb-c bal">${formatINR(b.amount)}</div>
      <div class="mb-c status">
        <span class="mb-pill ${b.paid ? 'paid' : 'unpaid'}">${b.paid ? 'Paid' : 'Unpaid'}</span>
      </div>
      <div class="mb-c menu"><span class="ico">${icons.more(11)}</span></div>
    </div>`;

  const sortable = label => `${esc(label)} <span class="ico mb-sort">${icons.sliders(8)}</span>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Sales', 'Sales Invoices')}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Sales Invoices</div>
      ${topActions([{ label: 'Reports', icon: 'ledger', kind: 'ghost', menu: true }])}
    </div>

    <div class="mb-stats">
      ${card('Total Sales', formatINR(day.total), 'all', 'total-sales')}
      ${card('Paid', formatINR(paid), 'collect')}
      ${card('Unpaid', formatINR(unpaid), 'pay')}
      ${card('Cancelled', '-', 'all')}
    </div>

    <div class="mb-bar">
      <span class="mb-icobtn square">${icons.search(11)}</span>
      <div class="mb-select" id="change-range">
        <span class="ico">${icons.calendar(10)}</span>Last 365 Days
      </div>
      <div class="mb-abtn ghost"><span class="ico">${icons.sliders(10)}</span>Bulk Actions <span class="ico mb-chev">${icons.chevDown(9)}</span></div>
      <div class="mb-abtn primary" id="new-bill">Create Sales Invoice</div>
    </div>

    <div class="mb-head-row">
      <div class="mb-c date">${sortable('Date')}</div>
      <div class="mb-c no">Invoice Number</div>
      <div class="mb-c nm">Party Name</div>
      <div class="mb-c due">Due In</div>
      <div class="mb-c bal">${sortable('Amount')}</div>
      <div class="mb-c status">Status</div>
      <div class="mb-c menu"></div>
    </div>
    <div class="mb-rows">${rows.map(row).join('')}</div>
  </div>

  ${pendingActions()}
</div>`;
}
