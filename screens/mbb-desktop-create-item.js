import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-create-item';

/* Create Item on a laptop - the same form as the phone's, in the laptop's
 * interface: a window over the Items page rather than a page of its own, which
 * is how the app opens it from "Create New Item" in the item catalogue
 * (reference/frames/dsk-mbb-28.png shows that button).
 *
 * It reads the same state the phone's create-item does - state.typed for the
 * name being typed, state.tab for which tab is showing, state.batching for the
 * batching switch - so the same recipe beats work in both shapes.
 *
 * DISCLOSED: no frame of this window exists. Its fields are the phone form's,
 * laid out as the app lays out its other laptop windows. It looks right; it
 * may not be right.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/items/create';

export const focus = { x: 360, y: 203, scale: 1 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'item-name': { x: 360, y: 134 },
  hsn: { x: 260, y: 181 },
  'tab-stock': { x: 257, y: 91 },
  batching: { x: 360, y: 227 },
  save: { x: 538, y: 349 }
};

export const tapEffects = {
  'tab-stock': { tab: 1 },
  batching: { batching: 1 }
};

export function render(data, state) {
  const typed = state?.typed ?? '';
  const stock = Number(state?.tab ?? 0) > 0;
  const batching = Number(state?.batching ?? 0) > 0;
  const item = (data?.items ?? [])[0] ?? {};

  const field = (label, value, id, wide) => `
    <div class="ci-field ${wide ? 'wide' : ''}" ${id ? `id="${id}"` : ''}>
      <div class="mb-field-k">${esc(label)}</div>
      <div class="mb-field-v">${value || '<span class="mb-blank"></span>'}</div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Items', 'Inventory')}

  <div class="mb-main">
    <div class="mb-top"><div class="mb-title">Items</div></div>
  </div>

  <div class="mb-scrim"></div>
  <div class="ci-win">
    <div class="mb-picker-top">
      <div class="mb-picker-k">Create New Item</div>
      <span class="ico">${icons.close(10)}</span>
    </div>

    <div class="ci-tabs">
      <span class="${stock ? '' : 'on'}">Basic Details</span>
      <span class="${stock ? 'on' : ''}" id="tab-stock">Stock Details</span>
      <span>Pricing</span>
    </div>

    <div class="ci-body">
      ${stock ? `
        ${field('Opening Stock', `${Number(item.stock ?? 0)} ${esc(item.unit || 'PCS')}`)}
        ${field('At Price', formatINR(item.purchase ?? 0))}
        ${field('Low Stock Alert', '5')}
        <div class="ci-switch" id="batching">
          <div>
            <div class="ci-switch-k">Batching</div>
            <div class="ci-switch-s">Track batch number, expiry and manufacturing date</div>
          </div>
          <span class="ci-toggle ${batching ? 'on' : ''}"><span class="ci-knob"></span></span>
        </div>
        ${batching ? `
          <div class="ci-batch">
            ${field('Batch No.', 'B-2026-04')}
            ${field('Expiry Date', '04/2028')}
            ${field('Mfg. Date', '04/2026')}
          </div>` : ''}
      ` : `
        ${field('Item Name', typed ? esc(typed) + '<span class="caret"></span>' : '', 'item-name', true)}
        ${field('HSN Code', '', 'hsn')}
        ${field('Unit', esc(item.unit || 'PCS'))}
        ${field('Sales Price', formatINR(item.rate ?? 0))}
        ${field('Purchase Price', formatINR(item.purchase ?? 0))}
        ${field('GST', `${Number(item.gst ?? 5)}%`)}
      `}
    </div>

    <div class="ci-foot">
      <div class="mb-abtn ghost">Cancel</div>
      <div class="mb-abtn primary" id="save">Save</div>
    </div>
  </div>
</div>`;
}
