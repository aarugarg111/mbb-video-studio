import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';
import { miraPanel, SCANNED } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-create-invoice';

/* Create Sales Invoice on a laptop (reference/frames/dsk-mbb-28.png and
 * dsk-mbb-76.png).
 *
 * The panel down the left is the part worth filming: "Autofill this bill,
 * powered by Mira AI" - drop a supplier's bill in and the fields fill
 * themselves. It is the same idea as Scan & Record on the phone, except the
 * whole form is visible while it happens, which is exactly the thing a phone
 * cannot show.
 *
 * state.filled is what the drop does: before it the form is empty outlines,
 * after it the party and the items are in place. That is the whole beat.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/vouchers/sales_invoice/create';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  'upload': { x: 85, y: 113 },
  'proceed': { x: 85, y: 181 },
  'save': { x: 454, y: 25 },
  'add-item': { x: 445, y: 173 }
};

/* Dropping the bill in is what fills the form. */
export const tapEffects = {
  'upload': { filled: 1 },
  'proceed': { filled: 1 }
};

/* Re-exported so the tests and anything else can still reach it from here. */
export { SCANNED };

export function render(data, state) {
  const filled = Number(state?.filled ?? 0) > 0;
  const party = data?.party?.name || '';
  const items = Array.isArray(data?.items) ? data.items.slice(0, 4) : [];
  /* Totalled from the lines actually on the bill, so the figures and the rows
   * agree - which is the only reason to show both. */
  const sums = summarise(items);

  const blank = '<span class="mb-blank"></span>';

  const line = (item, i) => `
    <div class="mb-irow">
      <div class="mb-ic no">${i + 1}</div>
      <div class="mb-ic nm">${esc(item.name)}</div>
      <div class="mb-ic qty">${Number(item.qty ?? 1)} ${esc(item.unit || 'PCS')}</div>
      <div class="mb-ic rate">${formatINR(item.rate ?? 0)}</div>
      <div class="mb-ic amt">${formatINR((Number(item.rate) || 0) * (Number(item.qty) || 1))}</div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${miraPanel(filled)}

  <div class="mb-form">
    <div class="mb-form-top">
      <span class="ico">${icons.back(13)}</span>
      <div class="mb-title sm">Create Sales Invoice</div>
      <div class="mb-abtn ghost">Save &amp; New</div>
      <div class="mb-abtn primary" id="save">Save</div>
    </div>

    <div class="mb-form-grid">
      <div class="mb-field ${filled && party ? 'set' : ''}">
        <div class="mb-field-k">Bill To</div>
        <div class="mb-field-v">${filled && party ? esc(party) : blank}</div>
      </div>
      <div class="mb-field set">
        <div class="mb-field-k">Invoice No.</div>
        <div class="mb-field-v">${esc(String(data?.invoice?.number ?? ''))}</div>
      </div>
      <div class="mb-field set">
        <div class="mb-field-k">Invoice Date</div>
        <div class="mb-field-v">${esc(String(data?.invoice?.date ?? ''))}</div>
      </div>
    </div>

    <div class="mb-ihead">
      <div class="mb-ic no">NO</div>
      <div class="mb-ic nm">ITEMS</div>
      <div class="mb-ic qty">QTY</div>
      <div class="mb-ic rate">PRICE/ITEM</div>
      <div class="mb-ic amt">AMOUNT</div>
    </div>

    <div class="mb-ilist">
      ${filled && items.length
        ? items.map(line).join('')
        : `<div class="mb-additem" id="add-item">+ Add Item</div>`}
    </div>

    <div class="mb-totals">
      <div class="mb-trow"><span>Taxable Amount</span><span>${filled ? formatINR(sums.taxable) : '&#8377;0'}</span></div>
      <div class="mb-trow"><span>Tax</span><span>${filled ? formatINR(sums.tax) : '&#8377;0'}</span></div>
      <div class="mb-trow big"><span>Total Amount</span><span>${filled ? formatINR(sums.total) : '&#8377;0'}</span></div>
    </div>
  </div>
</div>`;
}
