import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'items';

/* The Items list (reference/frames/item-t34.png). Coordinates are in 390x844
 * space, MEASURED from a render (getBoundingClientRect) - see
 * .superpowers/sdd/items-report.md. Re-measure if the layout changes. */
export const targets = {
  'create-new-item': { x: 127, y: 744 },
  'bulk-action': { x: 278, y: 744 },
  'item-row-0': { x: 195, y: 160 },
  'low-stock': { x: 56, y: 73 }
};

/* Tapping Low Stock narrows the list to what is running out. The change
 * lands with the ring, like the Create Item tabs. */
export const tapEffects = {
  'low-stock': { lowStock: 1 }
};

/* An item is low when it is down to the level its own record calls low, and
 * ten where the record does not say - which is what the app's own list
 * shows, down to and past zero. */
export const DEFAULT_LOW_AT = 10;

export function isLow(item) {
  const stock = Number(item?.stock ?? 90);
  const at = Number(item?.lowAt ?? DEFAULT_LOW_AT);
  return stock <= at;
}

export function lowStockItems(items) {
  return (items ?? []).filter(isLow);
}

const NAV = [
  ['Dashboard', 'navDashboard'], ['Parties', 'navParties'], ['Items', 'navItems'],
  ['For You', 'navForYou'], ['More', 'navMore']
];

/* The app shows what was paid for the item as well as what it sells for. A
 * recipe that gives only a sales rate gets a plausible purchase price, so the
 * column is never blank. */
const purchaseOf = item => Number(item.purchase ?? Math.round(Number(item.rate || 0) * 0.88));
const rupees = n => '₹ ' + Number(n || 0).toLocaleString('en-IN');

export function render(data, state) {
  const all = data?.items ?? [];
  const filtering = Number(state?.lowStock ?? 0) > 0;
  const items = filtering ? lowStockItems(all) : all;

  const row = (item, i) => {
    const unit = esc(item.unit || 'PCS');
    const stock = Number(item.stock ?? 90).toFixed(1);
    return `
      <div class="itcard" id="item-row-${i}">
        <div class="av">${esc(String(item.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="info">
          <div class="nm">${esc(item.name)}</div>
          <div class="cols">
            <div><div class="l">Sales Price</div><div class="v">${rupees(item.rate)}</div></div>
            <div><div class="l">Purchase Price</div><div class="v">${rupees(purchaseOf(item))}</div></div>
          </div>
        </div>
        <div class="stk"><div class="q${isLow(item) ? ' low' : ''}">${stock}</div><div class="u">${unit}</div><span class="ico">${icons.sliders(19)}</span></div>
      </div>`;
  };

  return `
<div class="screen itemsscreen" style="background: var(--mbb-page)">
  <div class="topbar">
    <div class="ttl">Items</div>
    <span class="ico">${icons.search(21)}</span>
    <span class="ico">${icons.settings(21)}</span>
  </div>
  <div class="fpills">
    <div class="fp${filtering ? ' sel' : ''}" id="low-stock">Low Stock${filtering ? `<span class="ico">${icons.close(14)}</span>` : ''}</div>
    <div class="fp">Select Category ${icons.chevDown(14)}</div>
    <div class="fp">Filter By <span class="ico on">${icons.filter(14)}</span></div>
  </div>
  <div class="itlist">
    ${items.length
      ? items.map(row).join('')
      : `<div class="itempty">Nothing is running low.</div>`}
  </div>
  <div class="floatbtns">
    <div class="fb create"><span class="ico">${icons.plusCircle(20)}</span>Create New Item</div>
    <div class="fb bulk"><span class="ico">${icons.folderUp(20)}</span>Bulk Action</div>
  </div>
  <div class="tabnav">
    ${NAV.map(([label, ic], i) => `<div class="${i === 2 ? 'on' : ''}"><span class="ico">${icons[ic](22)}</span>${label}</div>`).join('')}
  </div>
</div>`;
}
