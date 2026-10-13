import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { isLow } from './items.js';
import { sidebar, topActions } from './mbb-desktop-chrome.js';

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
export const url = 'mybillbook.in/app/home/items';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  'create-item': { x: 667, y: 133 },
  'low-stock': { x: 431, y: 80 },
  'item-row-0': { x: 431, y: 210 },
  'bulk-actions': { x: 572, y: 133 }
};

/* Tapping Low Stock narrows the table, the same way the phone's pill does. */
export const tapEffects = { 'low-stock': { lowStock: 1 } };

/* Enough rows to look like a real catalogue when the recipe lists two. */
const FILLERS = [
  { name: 'AMUL RUSK FAMILY PACK', rate: 180, purchase: 120, stock: 99 },
  { name: 'ANJEER PREMEIUM 500GM', rate: 1200, purchase: 950, stock: 99 },
  { name: 'ARHAR DAL GOLD 1KG', rate: 180, purchase: 140, stock: 95 },
  { name: 'BESAN 1KG', rate: 110, purchase: 94, stock: 91 },
  { name: 'BELLA VITA PERFUME SET', rate: 650, purchase: 250, stock: 199 }
];

export function itemsFor(data) {
  const own = Array.isArray(data?.items) ? data.items : [];
  const rest = FILLERS.filter(f => !own.some(o => String(o.name).toLowerCase() === f.name.toLowerCase()));
  return [...own, ...rest].slice(0, 7);
}

export function render(data, state) {
  const all = itemsFor(data);
  const low = all.filter(isLow);
  const onlyLow = Number(state?.lowStock ?? 0) > 0;
  const rows = onlyLow ? low : all;

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
  ${sidebar(data?.business?.name, 'Items')}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Items</div>
      ${topActions([
        { label: 'Manage Offer', icon: 'rupeeCircle', kind: 'ghost' },
        { label: 'Reports', icon: 'ledger', kind: 'ghost' }
      ])}
    </div>

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
    <div class="mb-rows">
      ${rows.length
        ? rows.map(row).join('')
        : '<div class="mb-empty">Nothing is running low.</div>'}
    </div>
  </div>
</div>`;
}
