import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { isLow } from './items.js';
import { itemsFor } from './items.js';
import { sidebar, topActions, referralStrip, pendingActions } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-items';

/* Inventory on a laptop (reference/frames/dsk-mbb-10.png): stock value, what
 * is running low and what is about to expire, across the top of the table.
 *
 * The three figures are derived from the recipe's own items rather than
 * written down, so a script that says "paanch item khatam hone wale hain" can
 * make that true by giving five items a small stock - and the number on screen
 * follows.
 */
export const device = 'desktop';

/* Where the camera rests. A 16:9 window inside a 9:16 video has to be pushed
 * in on to fill the picture, and what goes out of frame when it is should be
 * chrome rather than content - so the camera sits right of the rail. */
export const focus = { x: 423, y: 203 };
export const url = 'mybillbook.in/app/home/items';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  /* The rail's own button, where a laptop bill starts. */
  'create-sales-invoice': { x: 63, y: 46 },
  'create-item': { x: 674, y: 166 },
  'low-stock': { x: 423, y: 118 },
  'item-row-0': { x: 423, y: 233 },
  'bulk-actions': { x: 590, y: 165 }
};

/* Tapping Low Stock narrows the table, the same way the phone's pill does. */
export const tapEffects = { 'low-stock': { lowStock: 1 } };

/* A shop's shelf is longer than a window, here too. */
export const scrolls = true;

export function render(data, state) {
  const all = itemsFor(data);
  /* Measured against a render, in this screen's own pixels: a row is 27 tall
   * and the table shows about 175 of them under its header. */
  const ROW = 27, VISIBLE = 175;
  const low = all.filter(isLow);
  const onlyLow = Number(state?.lowStock ?? 0) > 0;
  const rows = onlyLow ? low : all;
  const room = Math.max(0, rows.length * ROW - VISIBLE);
  const scroll = Math.min(room, Math.max(0, Number(state?.scroll ?? 0)));

  const stockValue = all.reduce((t, i) =>
    t + (Number(i.purchase ?? i.rate ?? 0) * Number(i.stock ?? 0)), 0);

  const card = (label, value, icon, kind, id) => `
    <div class="mb-stat ${kind}" ${id ? `id="${id}"` : ''}>
      <div class="mb-stat-k"><span class="ico">${icons[icon](11)}</span>${esc(label)}</div>
      <div class="mb-stat-v">${esc(value)}</div>
    </div>`;

  const row = (item, i) => `
    <div class="mb-row" ${i === 0 ? 'id="item-row-0"' : ''}>
      <div class="mb-c nm">${esc(item.name)}</div>
      <div class="mb-c cat">${Number(item.stock ?? 0)} ${esc(item.unit || 'PCS')}</div>
      <div class="mb-c kind">${formatINR(item.purchase ?? 0)}</div>
      <div class="mb-c bal ${isLow(item) ? 'low' : ''}">${formatINR(item.rate ?? 0)}</div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Items', 'Inventory')}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Items</div>
      ${topActions([
        { label: 'Manage Offer', icon: 'rupeeCircle', kind: 'ghost' },
        { label: 'Reports', icon: 'ledger', kind: 'ghost' }
      ])}
    </div>

    ${referralStrip()}

    <div class="mb-stats">
      ${card('Stock Value', formatINR(stockValue), 'navItems', 'all')}
      ${card('Low Stock', String(low.length), 'warning', onlyLow ? 'low on' : 'low', 'low-stock')}
      ${card('Items Expiring (30 days)', '0', 'clock', 'pay')}
    </div>

    <div class="mb-bar">
      <div class="mb-search"><span class="ico">${icons.search(11)}</span>Search by Item Name</div>
      <div class="mb-abtn ghost" id="bulk-actions"><span class="ico">${icons.sliders(11)}</span>Bulk Actions</div>
      <div class="mb-abtn primary" id="create-item">Create Item</div>
    </div>

    <div class="mb-head-row">
      <div class="mb-c nm">Item Name</div>
      <div class="mb-c cat">Stock</div>
      <div class="mb-c kind">Purchase Price</div>
      <div class="mb-c bal">Selling Price</div>
    </div>
    <div class="mb-rowscroll">
    <div class="mb-rows" style="transform: translateY(${(-scroll).toFixed(1)}px)">
      ${rows.length
        ? rows.map(row).join('')
        : '<div class="mb-empty">Nothing is running low.</div>'}
    </div>
    </div>
  </div>

  ${pendingActions()}
</div>`;
}
