import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { billMarkup } from './invoice-created.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-invoice';

/* The bill after it is made, on a laptop (reference/frames/dsk-mbb-40.png):
 * the invoice itself in the middle, what has been paid down the right, and the
 * things you can do with it across the top.
 *
 * The bill is billMarkup() - the SAME markup the phone draws and the camera
 * films. A second copy would drift and the video would contradict itself
 * between two shots of one invoice. It is drawn at the phone's own width and
 * scaled to fit the pane, so its proportions survive.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/vouchers/sales_invoice/view';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  'record-payment': { x: 644, y: 60 },
  'share': { x: 356, y: 60 },
  'download-pdf': { x: 221, y: 60 },
  'theme-store': { x: 650, y: 100 }
};

/* Recording the payment is the beat: unpaid becomes paid on camera. */
export const tapEffects = { 'record-payment': { paid: 1 } };

export function render(data, state) {
  const sums = summarise(data?.items ?? []);
  const inv = invoiceOf(data ?? {});
  const paid = Number(state?.paid ?? 0) > 0;
  const received = paid ? sums.total : 0;

  const action = (label, icon, id, kind = '') => `
    <div class="mb-vbtn ${kind}" ${id ? `id="${id}"` : ''}>
      ${icon ? `<span class="ico">${icons[icon](11)}</span>` : ''}${esc(label)}
    </div>`;

  const money = (label, value, kind = '') => `
    <div class="mb-pay-row ${kind}"><span>${esc(label)}</span><span>${formatINR(value)}</span></div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Sales')}

  <div class="mb-main view">
    <div class="mb-top">
      <span class="ico">${icons.back(13)}</span>
      <div class="mb-title sm">Sales Invoice #${esc(String(inv.number))}</div>
      <span class="mb-status ${paid ? 'paid' : ''}">${paid ? 'Paid' : 'Unpaid'}</span>
    </div>

    <div class="mb-theme-strip" id="theme-store">
      Bring a premium touch to every invoice with <b>Theme Store</b>
    </div>

    <div class="mb-vbar">
      ${action('Download PDF', 'download', 'download-pdf')}
      ${action('Print PDF', 'print')}
      ${action('Share', 'share', 'share')}
      ${action('Record Payment In', '', 'record-payment', 'primary')}
    </div>

    <div class="mb-view-body">
      <div class="mb-paper">
        <div class="mb-paper-fit">${billMarkup(data ?? {}, { ...state, appear: 1 })}</div>
      </div>

      <div class="mb-payhist">
        <div class="mb-payhist-k">Payment History</div>
        ${money('Invoice Amount', sums.total)}
        ${money('Amount Received', received)}
        <div class="mb-pay-rule"></div>
        ${money('Balance Amount', sums.total - received, paid ? 'done' : 'due')}
        ${paid ? `
          <div class="mb-paid-note">
            <span class="ico">${icons.check(12)}</span>Payment recorded
          </div>` : ''}
      </div>
    </div>
  </div>
</div>`;
}
