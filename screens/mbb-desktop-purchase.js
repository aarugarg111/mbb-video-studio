import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';
import { miraPanel } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-purchase';

/* Create Purchase Invoice on a laptop (reference/frames/dsk-mbb-76.png): the
 * supplier's bill going in rather than a customer's coming out.
 *
 * Same Mira AI panel as the sales side - it is the same feature, so it is the
 * same code. This is the version a wholesaler's script wants: a bill arrives
 * on paper and the form fills itself.
 *
 * The real table has eleven columns (HSN, batch, expiry, manufacture, discount,
 * tax...). At 720 logical pixels those would be four pixels wide each, so this
 * carries the ones a video can actually show. The same call as the Tally
 * report: legible beats complete.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/vouchers/purchase_record/create';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  'upload': { x: 85, y: 113 },
  'proceed': { x: 85, y: 181 },
  'save': { x: 674, y: 25 },
  'add-party': { x: 300, y: 85 }
};

export const tapEffects = {
  'upload': { filled: 1 },
  'proceed': { filled: 1 }
};

export function render(data, state) {
  const filled = Number(state?.filled ?? 0) > 0;
  const supplier = data?.party?.name || '';
  const items = Array.isArray(data?.items) ? data.items.slice(0, 4) : [];
  const sums = summarise(filled ? items : []);

  const line = (item, i) => `
    <div class="mb-irow">
      <div class="mb-ic no">${i + 1}</div>
      <div class="mb-ic nm">${esc(item.name)}</div>
      <div class="mb-ic qty">${Number(item.qty ?? 1)} ${esc(item.unit || 'PCS')}</div>
      <div class="mb-ic rate">${formatINR(item.purchase ?? item.rate ?? 0)}</div>
      <div class="mb-ic amt">${formatINR((Number(item.purchase ?? item.rate) || 0) * (Number(item.qty) || 1))}</div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${miraPanel(filled)}

  <div class="mb-form">
    <div class="mb-form-top">
      <span class="ico">${icons.back(13)}</span>
      <div class="mb-title sm">Create Purchase Invoice</div>
      <div class="mb-abtn ghost"><span class="ico">${icons.camera(11)}</span>Upload using Phone</div>
      <div class="mb-abtn primary" id="save">Save</div>
    </div>

    <div class="mb-form-grid">
      <div class="mb-field ${filled && supplier ? 'set' : ''}" id="add-party">
        <div class="mb-field-k">Bill From</div>
        <div class="mb-field-v">${filled && supplier ? esc(supplier) : '<span class="mb-blank"></span>'}</div>
      </div>
      <div class="mb-field set">
        <div class="mb-field-k">Purchase Invoice No.</div>
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
        : '<div class="mb-additem">+ Add Item</div>'}
    </div>

    <div class="mb-totals">
      <div class="mb-trow"><span>Taxable Amount</span><span>${formatINR(sums.taxable)}</span></div>
      <div class="mb-trow"><span>Tax</span><span>${formatINR(sums.tax)}</span></div>
      <div class="mb-trow big"><span>Total Amount</span><span>${formatINR(sums.total)}</span></div>
    </div>
  </div>
</div>`;
}
