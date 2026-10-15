import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';

export const name = 'create-party';

/* Create New Party - adding a customer or a supplier.
 *
 * "Create Party" has been a button on the parties screen since it was built,
 * in both shapes, and nothing was behind it. A clip that said "naya customer
 * add karo" could show the tap and then had nowhere to cut to, so the one
 * thing every new user does first was the one process the studio could not
 * film.
 *
 * It is the phone's form; mbb-desktop-create-party is the same form in the
 * laptop's interface.
 *
 * DISCLOSED: no reference frame of this form exists. Its fields are the ones a
 * party needs - who they are, how to reach them, which way the money goes, and
 * what they already owe - laid out the way the app lays out create-item, which
 * IS taken from a frame. It looks right; it may not be right.
 *
 * Coordinates are in 390x844 space and are MEASURED.
 */
export const targets = {
  'party-name': { x: 195, y: 110 },
  'party-phone': { x: 195, y: 183 },
  'type-supplier': { x: 113, y: 256 },
  'opening-balance': { x: 120, y: 330 },
  gstin: { x: 195, y: 405 },
  save: { x: 127, y: 802 }
};

/* Which way the money goes is the one choice on this form that changes what
 * the party IS, so it is the one a clip can be seen making. */
export const tapEffects = {
  'type-supplier': { kind: 'Supplier' },
  gstin: { gst: 1 }
};

export function render(data, state) {
  const typed = state?.typed ?? '';
  const kind = state?.kind === 'Supplier' ? 'Supplier' : 'Customer';
  const gst = Number(state?.gst ?? 0) > 0;
  const party = data?.party ?? {};
  /* The number is the recipe's own, and the recipe's parties are invented. */
  const phone = party.phone || '98765 43210';
  const opening = Number(party.balance ?? 0);

  return `
<div class="screen itemform" style="background: var(--mbb-page)">
  <div class="topbar">
    <span class="ico back">${icons.back(24)}</span>
    <div class="ttl">Create New Party</div>
    <span class="ico">${icons.settings(21)}</span>
  </div>

  <div class="fl">Party Name<span class="req">*</span></div>
  <div class="inp" id="party-name"><span class="${typed ? '' : 'muted'}">${typed ? esc(typed) + '<span class="caret"></span>' : ''}</span></div>

  <div class="fl">Mobile Number</div>
  <div class="inp" id="party-phone"><span class="grow">${esc(phone)}</span><span class="ico muted">${icons.person(20)}</span></div>

  <!-- Customer or supplier: everything else about this party follows from it,
       which is why it is a choice and not a setting buried further down. -->
  <div class="fl">Party Type</div>
  <div class="pp">
    <span class="chip${kind === 'Customer' ? ' on' : ''}" id="type-customer">Customer</span>
    <span class="chip${kind === 'Supplier' ? ' on' : ''}" id="type-supplier">Supplier</span>
  </div>

  <div class="hsnrow">
    <div class="hsn">
      <div class="fl">Opening Balance</div>
      <div class="inp" id="opening-balance"><span class="grow">${formatINR(opening)}</span></div>
    </div>
    <div class="ityp">
      <div class="fl">To ${kind === 'Supplier' ? 'Pay' : 'Collect'}</div>
      <div class="pp"><span class="chip on">${kind === 'Supplier' ? 'Debit' : 'Credit'}</span></div>
    </div>
  </div>

  <div class="fl">GSTIN</div>
  <div class="inp" id="gstin">
    <span class="${gst ? 'grow' : 'grow muted'}">${gst ? esc(data?.business?.gstin || '27AAAAA0000A1Z5') : 'Optional'}</span>
    ${gst ? `<span class="ico">${icons.check(18)}</span>` : ''}
  </div>
  ${gst ? '<div class="invrow"><span class="grow">GST details fetched</span></div>' : ''}

  <div class="savebar"><div class="savebtn" id="save">Save Party</div></div>
</div>`;
}
