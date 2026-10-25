import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { billMarkup } from './invoice-created.js';

export const name = 'bill-open';

/* A bill that already exists, opened from the list.
 *
 * invoice-created is the moment a bill is MADE - it springs in, it says
 * Created, it offers Done. This is the same bill looked up afterwards, which
 * is a different beat and the commoner one: a customer rings up asking what
 * they owe, and the owner finds their bill and reads it back.
 *
 * It is the SAME bill markup the rest of the studio draws, so a script that
 * zooms at the mobile number here and at the total on the created screen is
 * looking at the same two places on the same bill.
 *
 * DISCLOSED: no reference frame of this screen exists. The bar is the app's
 * own voucher bar - back, edit, delete, more - over the bill, with what is
 * still owed on it, which is what the list it came from shows. It looks
 * right; it may not be right.
 *
 * Coordinates are in 390x844 space and are MEASURED.
 */
export const targets = {
  back: { x: 27, y: 28 },
  edit: { x: 326, y: 28 },
  share: { x: 212, y: 807 },
  'record-payment': { x: 87, y: 807 },
  download: { x: 320, y: 807 }
};

/* Places, not buttons. Nothing here is pressed and all of it gets pointed at
 * by a script: "uska number dekho", "ye item dekho", "kitna baaki hai". They
 * are inside the bill, so they are the bill's own and the same on every
 * screen that draws one. */
export const zoomPoints = {
  customer: { x: 119, y: 280 },
  'mobile-number': { x: 119, y: 295 },
  'invoice-number': { x: 119, y: 224 },
  'invoice-date': { x: 270, y: 224 },
  'bill-items': { x: 195, y: 352 },
  totals: { x: 270, y: 487 },
  balance: { x: 270, y: 530 }
};

/* Taking the payment is the beat: unpaid becomes paid while the camera is on
 * it, the same way it does on the laptop's bill. */
export const tapEffects = { 'record-payment': { paid: 1 } };

export function render(data, state) {
  const inv = invoiceOf(data ?? {});
  const sums = summarise(data?.items ?? []);
  const paid = Number(state?.paid ?? 0) > 0;

  const action = (id, label, icon) => `
    <div class="bo-act" id="${id}"><span class="ico">${icons[icon](19)}</span>${esc(label)}</div>`;

  return `
<div class="screen boscreen">
  <div class="topbar">
    <span class="ico back" id="back">${icons.back(24)}</span>
    <div class="titles">
      <h1>Sales Invoice #${esc(String(inv.number))}</h1>
      <div class="sub">${esc(inv.date)}</div>
    </div>
    <span class="ico" id="edit">${icons.edit(21)}</span>
    <span class="ico">${icons.more(21)}</span>
  </div>

  <!-- What the list that led here was showing: whether this one is settled. -->
  <div class="bo-state ${paid ? 'paid' : ''}">
    <span class="bo-chip">${paid ? 'Paid' : 'Unpaid'}</span>
    <span class="bo-owed">
      ${paid ? 'Settled in full' : `${formatINR(sums.total)} outstanding`}
    </span>
  </div>

  <!-- The bill agrees with the strip above it: owed in full until the
       payment is recorded, settled after. -->
  <div class="bo-paper">${billMarkup(data ?? {}, { ...state, appear: 1, received: paid ? sums.total : 0 })}</div>

  <div class="bo-bar">
    ${action('record-payment', paid ? 'Payment recorded' : 'Record Payment', 'rupeeCircle')}
    ${action('share', 'Share', 'whatsapp')}
    ${action('download', 'Download', 'download')}
  </div>
</div>`;
}
