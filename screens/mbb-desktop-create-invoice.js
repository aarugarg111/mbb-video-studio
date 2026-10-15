import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { miraPanel, itemPicker } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-create-invoice';

/* Create Sales Invoice on a laptop (reference/frames/dsk-mbb-22.png and
 * dsk-mbb-28.png).
 *
 * Rebuilt, because the first version had the wrong idea of what billing on a
 * laptop IS. It drew Mira AI's autofill panel and little else, so the only way
 * to make a bill in a laptop video was to drop a supplier's document on it and
 * let the AI read it. That is a feature of this screen, not the screen: the
 * ordinary way is the same as on the phone - open the form, add items, save -
 * and a script that says "bill banao" meant that one.
 *
 * So this is the form: the party across the top, the item table down the
 * middle, the money down the right, and the "Add Items to Bill" window over
 * all of it while the items are being picked. Mira's panel stays where the app
 * keeps it, at the left.
 *
 * It reads the SAME state the phone's create-invoice does - state.items is a
 * per-item 0..1, state.typed is the search text, state.bill the running
 * summary - so a recipe's addItem beats mean the same thing in both shapes,
 * and the two cannot come to disagree about what a bill adds up to.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/vouchers/sales_invoice/create';

/* The form is full width with Mira's panel on one side and the totals on the
 * other, and both edges carry something a clip taps, so the camera holds the
 * whole window rather than pushing in. */
export const focus = { x: 360, y: 203, scale: 1 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'add-item': { x: 285, y: 207 },
  'item-search': { x: 261, y: 94 },
  'add-item-0': { x: 585, y: 163 },
  'add-item-1': { x: 585, y: 195 },
  'add-to-bill': { x: 572, y: 363 },
  'save': { x: 691, y: 19 },
  'add-party': { x: 195, y: 87 },
  'upload': { x: 64, y: 185 },
  'proceed': { x: 64, y: 258 }
};

/* "+ Add Item" opens the picker and "Add to Bill" closes it over a filled
 * table. Mira's two buttons fill the same table the other way round. */
export const tapEffects = {
  'add-item': { picker: 1 },
  'add-to-bill': { picker: 0 },
  'upload': { filled: 1, picker: 0 },
  'proceed': { filled: 1, picker: 0 }
};

export function render(data, state) {
  const inv = invoiceOf(data ?? {});
  const items = Array.isArray(data?.items) ? data.items : [];
  const progress = state?.items ?? [];
  const picker = Number(state?.picker ?? 0) > 0;
  /* Mira's autofill puts every line on the bill at once. */
  const filled = Number(state?.filled ?? 0) > 0;
  const typed = state?.typed ?? '';
  const onBill = i => filled || (progress[i] ?? 0) > 0.001;

  const chosen = items.filter((_, i) => onBill(i));
  const sums = chosen.length ? summarise(chosen) : summarise([]);
  const party = data?.party?.name || '';

  const line = (item, n) => `
    <div class="mb-irow">
      <div class="mb-ic no">${n}</div>
      <div class="mb-ic nm">${esc(item.name)}</div>
      <div class="mb-ic qty">${Number(item.qty ?? 1)} ${esc(item.unit || 'PCS')}</div>
      <div class="mb-ic rate">${formatINR(item.rate ?? 0)}</div>
      <div class="mb-ic disc">-</div>
      <div class="mb-ic tax">${Number(item.gst ?? 0)}%</div>
      <div class="mb-ic amt">${formatINR((Number(item.rate) || 0) * (Number(item.qty) || 1))}</div>
    </div>`;

  const money = (label, value, kind = '') => `
    <div class="mb-tot-row ${kind}"><span>${esc(label)}</span><span>${formatINR(value)}</span></div>`;

  return `
<div class="screen mbscreen form">
  <div class="mb-form-bar">
    <span class="ico">${icons.back(11)}</span><span class="mb-exit">Exit</span>
    <div class="mb-title sm">Create Sales Invoice</div>
    <div class="mb-mode"><span class="on">Edit Mode</span><span>Preview Mode</span></div>
    <span class="mb-icobtn sm">${icons.settings(10)}</span>
    <div class="mb-abtn ghost">Save &amp; New</div>
    <div class="mb-abtn primary" id="save">Save</div>
  </div>

  <div class="mb-form-body">
    ${miraPanel(filled, true)}

    <div class="mb-form-main">
      <div class="mb-party-row">
        <div class="mb-party" id="add-party">
          <div class="mb-field-k">Bill To</div>
          <div class="mb-party-nm">${party ? esc(party) : '<span class="mb-blank"></span>'}</div>
          ${data?.party?.address ? `<div class="mb-party-sub">${esc(data.party.address)}</div>` : ''}
        </div>
        <div class="mb-party">
          <div class="mb-field-k">Ship To</div>
          <div class="mb-party-nm">${party ? esc(party) : '<span class="mb-blank"></span>'}</div>
        </div>
        <div class="mb-party-nos">
          <div class="mb-field set"><div class="mb-field-k">Sales Invoice No.</div><div class="mb-field-v">${esc(String(inv.number))}</div></div>
          <div class="mb-field set"><div class="mb-field-k">Sales Invoice Date</div><div class="mb-field-v">${esc(String(inv.date))}</div></div>
        </div>
      </div>

      <div class="mb-items-k">Add Items to Bill</div>

      <div class="mb-ihead">
        <div class="mb-ic no">NO</div>
        <div class="mb-ic nm">ITEMS</div>
        <div class="mb-ic qty">QTY</div>
        <div class="mb-ic rate">PRICE/ITEM (&#8377;)</div>
        <div class="mb-ic disc">DISCOUNT</div>
        <div class="mb-ic tax">TAX</div>
        <div class="mb-ic amt">AMOUNT (&#8377;)</div>
      </div>

      <div class="mb-ilist">
        ${chosen.map((item, n) => line(item, n + 1)).join('')}
        <div class="mb-additem-row">
          <span class="mb-additem" id="add-item">+ Add Item</span>
          <span class="mb-barcode"><span class="ico">${icons.scan(9)}</span>Scan Barcode</span>
        </div>
      </div>

      <div class="mb-subtotal"><span>Subtotal</span><span>${formatINR(sums.total)}</span></div>
    </div>

    <div class="mb-form-money">
      <div class="mb-tot-link"><span class="ico">${icons.plus(8)}</span>Add Additional Charges</div>
      ${money('Taxable Amount', sums.taxable)}
      <div class="mb-tot-link"><span class="ico">${icons.plus(8)}</span>Add Discount</div>
      ${money('Tax', sums.tax)}
      <div class="mb-tot-rule"></div>
      ${money('Total Amount', sums.total, 'big')}
      ${money('Total Amount Received', 0)}
      ${money('Balance Amount', sums.total, 'due')}
    </div>
  </div>

  <div class="mb-keys">
    <span class="mb-keys-k">Keyboard Shortcuts :</span>
    <span>Change Quantity <b>Enter</b></span>
    <span>Move between items <b>&#8593;</b><b>&#8595;</b></span>
  </div>

  ${picker ? itemPicker({ items, onBill, typed, chosen, total: sums.total }) : ''}
</div>`;
}
