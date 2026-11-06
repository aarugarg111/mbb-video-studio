import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { shelfFor } from '../src/shelves.js';

export const name = 'items';

/* The Items list (reference/frames/item-t34.png). Coordinates are in 390x844
 * space, MEASURED from a render (getBoundingClientRect) - see
 * .superpowers/sdd/items-report.md. Re-measure if the layout changes. */
export const targets = {
  'create-new-item': { x: 127, y: 744 },
  'bulk-action': { x: 278, y: 744 },
  /* RE-MEASURED after the promo strip was added above the list: it pushed
     every row down by 105 of this screen's pixels. No recipe taps a row, so
     nothing was aimed at the old places - but a zoom would have been. */
  'item-row-0': { x: 195, y: 264 },
  'item-row-1': { x: 195, y: 358 },
  'item-row-2': { x: 195, y: 452 },
  'item-row-3': { x: 195, y: 546 },
  'item-row-4': { x: 195, y: 640 },
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

const ROWS = 14;

/* The page is the recipe's own items, then the rest of that shop's shelf.
 *
 * The shelf comes from src/shelves.js and follows the shop's trade. It used
 * to be one fixed kirana list, so a cosmetics shop's Items page read FACEWASH,
 * NAIL PAINT, then ARHAR DAL GOLD 1KG and BESAN 1KG - the same page showing
 * two different shops, three rows apart.
 *
 * Shared with the laptop's Items page rather than copied: one business cannot
 * be stocking two different catalogues. */
export function itemsFor(data) {
  const own = Array.isArray(data?.items) ? data.items : [];
  return [...own, ...shelfFor(data)].slice(0, ROWS);
}

/* What the page shows when Low Stock is on.
 *
 * Taken from the shop, not from the fourteen rows that happened to fit.
 * Filtering the page meant a script listing a dozen healthy items of its own
 * filled every row before one shelf item got in, so Low Stock came up empty
 * - the one thing that screen must never do, because a script only asks for
 * it when running out IS the story. The studio warned about it instead,
 * which told the writer to go and edit stock figures by hand to get the
 * screen they had already asked for.
 *
 * The shop's own low items lead, and the shelf only makes up the numbers.
 * It used to be added whatever the script had said, so "Low Stock - agro
 * products, five items" drew the five that were asked for and then five
 * groceries underneath them: the same shop stocking two trades, which is a
 * bug this studio has now had twice. A script that names enough gets what it
 * named and nothing else. */
const MIN_LOW_ROWS = 5;

export function lowStockFor(data) {
  const own = (Array.isArray(data?.items) ? data.items : []).filter(isLow);
  if (own.length >= MIN_LOW_ROWS) return own.slice(0, ROWS);
  /* Short of a screenful, so the rest of the shop's own shelf tops it up -
   * never past the minimum, because padding beyond that is inventing stock
   * nobody asked about. */
  return [...own, ...shelfFor(data).filter(isLow)].slice(0, MIN_LOW_ROWS);
}

/* The strip across the top of the list, offering to read items off a bill.
 *
 * It is in the app's own Items page and it scrolls with the list, so it is
 * drawn here rather than in the header. Its right-hand third is left empty:
 * the app puts an illustration there, that illustration is FloBiz marketing
 * artwork, and an imitation of it in a public repo is worse than a gap.
 *
 * MEASURED from a render - test/low-stock.test.js measures it again, because
 * the list scrolls past it and a wrong height is a list that stops short. */
export const PROMO_HEIGHT = 104;

const PROMO = `
      <div class="ipromo">
        <div class="ipromo-t">Instantly add items <span class="ipromo-hi">with just<br>a click of your bill</span></div>
        <div class="ipromo-btn">Try Now &#8594;</div>
        <span class="ico ipromo-x">${icons.close(10)}</span>
      </div>`;

/* A shop's shelf is longer than a phone. */
export const scrolls = true;

/* These move with the list. Everything else on the screen stays put, so only
 * these have the scroll taken off them when the camera is told where to go. */
export const scrollingTargets = ['item-row-0', 'item-row-1', 'item-row-2', 'item-row-3', 'item-row-4'];

export function render(data, state) {
  const all = itemsFor(data);
  /* Measured against a render: a card is 94 of this screen's pixels tall, and
   * the list shows about 626 of them between the filter pills and the tab bar.
   * A scroll longer than the list leaves is clamped, so the worst a recipe can
   * do is stop at the bottom rather than scroll into nothing. */
  const CARD = 94, VISIBLE = 626;
  const filtering = Number(state?.lowStock ?? 0) > 0;
  const items = filtering ? lowStockFor(data) : all;
  /* The promo strip scrolls with the list, so it is part of what there is to
   * scroll past. Left out of this, a short list would refuse to scroll far
   * enough to clear it. */
  const room = Math.max(0, items.length * CARD + PROMO_HEIGHT - VISIBLE);
  const scroll = Math.min(room, Math.max(0, Number(state?.scroll ?? 0)));

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
  <div class="itscroll">
  <div class="itlist" style="transform: translateY(${(-scroll).toFixed(1)}px)">
    ${PROMO}
    ${items.length
      ? items.map(row).join('')
      : `<div class="itempty">Nothing is running low.</div>`}
  </div>
  </div>
  <div class="floatbtns">
    <div class="fb create" id="create-new-item"><span class="ico">${icons.plusCircle(20)}</span>Create New Item</div>
    <div class="fb bulk" id="bulk-action"><span class="ico">${icons.folderUp(20)}</span>Bulk Action</div>
  </div>
  <div class="tabnav">
    ${NAV.map(([label, ic], i) => `<div class="${i === 2 ? 'on' : ''}"><span class="ico">${icons[ic](22)}</span>${label}</div>`).join('')}
  </div>
</div>`;
}
