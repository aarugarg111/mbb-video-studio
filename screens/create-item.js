import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'create-item';

/* Create New Item (reference/frames/item-t42.png). Coordinates are in 390x844
 * space, MEASURED from a render - see .superpowers/sdd/items-report.md. */
export const targets = {
  'item-name': { x: 195, y: 110 },
  hsn: { x: 121, y: 186 },
  'tab-stock': { x: 99, y: 245 },
  batching: { x: 240, y: 308 },
  save: { x: 264, y: 802 }
};

/* What a tap does to the screen. The timeline applies these once the tap has
 * landed, so the tab and the Batching pill change when the ring appears. */
export const tapEffects = {
  'tab-stock': { tab: 'Stock' },
  batching: { batching: 1 }
};

export const TABS = ['Pricing', 'Stock', 'Other', 'Party Wise Prices'];

export function render(data, state) {
  const typed = state?.typed ?? '';
  const tab = TABS.includes(state?.tab) ? state.tab : 'Pricing';
  const batching = (state?.batching ?? 0) > 0;

  return `
<div class="screen itemform" style="background: var(--mbb-page)">
  <div class="topbar">
    <span class="ico back">${icons.back(24)}</span>
    <div class="ttl">Create New Item</div>
    <span class="ico">${icons.settings(21)}</span>
  </div>

  <div class="fl">Item Name<span class="req">*</span></div>
  <div class="inp" id="item-name-field"><span class="${typed ? '' : 'muted'}">${typed ? esc(typed) + '<span class="caret"></span>' : ''}</span></div>

  <div class="hsnrow">
    <div class="hsn">
      <div class="fl">HSN</div>
      <div class="inp" id="hsn-field"><span class="grow muted">Ex: 6704</span><span class="ico muted">${icons.search(20)}</span></div>
    </div>
    <div class="ityp">
      <div class="fl">Item Type</div>
      <div class="pp"><span class="chip on">Product</span><span class="chip">Service</span></div>
    </div>
  </div>

  <div class="tabs">
    ${TABS.map(t => `<div class="tab${t === tab ? ' on' : ''}" id="tab-${esc(t.toLowerCase().split(' ')[0])}">${t}</div>`).join('')}
  </div>

  <div class="invrow">
    <span class="grow">Inventory Tracking By</span>
    <span class="chip${batching ? ' on' : ''}" id="batching">Batching</span>
    <span class="chip" id="imei">IMEI/Serial No</span>
  </div>

  <div class="unit">
    <div class="fl">Unit</div>
    <div class="inp"><span>PCS</span></div>
  </div>

  <div class="savebar">
    <div class="sn"><div class="a">Save &amp; New</div><div class="b">Create New Item</div></div>
    <div class="savebtn" id="save">Save</div>
  </div>
</div>`;
}
