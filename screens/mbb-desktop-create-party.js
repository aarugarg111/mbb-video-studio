import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-create-party';

/* Create New Party on a laptop - the same form as the phone's, in the laptop's
 * interface: a window over the Parties page rather than a page of its own,
 * which is how the app opens its other forms on a desktop.
 *
 * It reads the same state the phone's create-party does - state.typed for the
 * name being typed, state.kind for customer or supplier, state.gst once the
 * GSTIN is filled - so the same recipe beats work in both shapes.
 *
 * DISCLOSED: no reference frame. See screens/create-party.js.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/parties/create';

export const focus = { x: 360, y: 203, scale: 1 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'party-name': { x: 360, y: 108 },
  'party-phone': { x: 260, y: 157 },
  'type-supplier': { x: 464, y: 163 },
  'opening-balance': { x: 260, y: 206 },
  gstin: { x: 360, y: 253 },
  save: { x: 526, y: 349 }
};

export const tapEffects = {
  'type-supplier': { kind: 'Supplier' },
  gstin: { gst: 1 }
};

export function render(data, state) {
  const typed = state?.typed ?? '';
  const kind = state?.kind === 'Supplier' ? 'Supplier' : 'Customer';
  const gst = Number(state?.gst ?? 0) > 0;
  const party = data?.party ?? {};
  const phone = party.phone || '98765 43210';
  const opening = Number(party.balance ?? 0);

  const field = (label, value, id, wide) => `
    <div class="ci-field ${wide ? 'wide' : ''}" ${id ? `id="${id}"` : ''}>
      <div class="mb-field-k">${esc(label)}</div>
      <div class="mb-field-v">${value || '<span class="mb-blank"></span>'}</div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Parties', 'Parties')}

  <div class="mb-main">
    <div class="mb-top"><div class="mb-title">Parties</div></div>
  </div>

  <div class="mb-scrim"></div>
  <div class="ci-win">
    <div class="mb-picker-top">
      <div class="mb-picker-k">Create New Party</div>
      <span class="ico">${icons.close(10)}</span>
    </div>

    <div class="ci-body">
      ${field('Party Name', typed ? esc(typed) + '<span class="caret"></span>' : '', 'party-name', true)}
      ${field('Mobile Number', esc(phone), 'party-phone')}

      <!-- Customer or supplier decides which way the money goes, so it is a
           choice on the form rather than a setting somewhere else. -->
      <div class="ci-field">
        <div class="mb-field-k">Party Type</div>
        <div class="ci-pp">
          <span class="ci-chip ${kind === 'Customer' ? 'on' : ''}" id="type-customer">Customer</span>
          <span class="ci-chip ${kind === 'Supplier' ? 'on' : ''}" id="type-supplier">Supplier</span>
        </div>
      </div>

      ${field('Opening Balance', formatINR(opening), 'opening-balance')}
      ${field(`To ${kind === 'Supplier' ? 'Pay' : 'Collect'}`, kind === 'Supplier' ? 'Debit' : 'Credit')}
      ${field('GSTIN', gst ? esc(data?.business?.gstin || '27AAAAA0000A1Z5') : '', 'gstin', true)}
      ${gst ? `
        <div class="ci-note">
          <span class="ico">${icons.check(11)}</span>GST details fetched from the GSTIN
        </div>` : ''}
    </div>

    <div class="ci-foot">
      <div class="mb-abtn ghost">Cancel</div>
      <div class="mb-abtn primary" id="save">Save Party</div>
    </div>
  </div>
</div>`;
}
