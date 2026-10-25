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

/* Where the camera rests. A 16:9 window inside a 9:16 video has to be pushed
 * in on to fill the picture, and what goes out of frame when it is should be
 * chrome rather than content - so the camera sits right of the rail. */
export const focus = { x: 423, y: 203 };
export const url = 'mybillbook.in/app/home/vouchers/sales_invoice/view';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  /* The rail's own button, where a laptop bill starts. */
  'create-sales-invoice': { x: 63, y: 46 },
  'record-payment': { x: 665, y: 93 },
  'share': { x: 357, y: 93 },
  'share-whatsapp': { x: 375, y: 140 },
  'download-pdf': { x: 187, y: 93 },
  'theme-store': { x: 423, y: 55 }
};

/* Recording the payment is the beat: unpaid becomes paid on camera.
 *
 * Share carries a dropdown arrow in the recording, and this is what is behind
 * it: the same choices the phone's share sheet offers, as a menu beside the
 * bill rather than a sheet sliding up from the bottom. Same flow, different
 * interface - which is the whole rule for these laptop screens. */
/* The places inside the bill, which are the bill's own - the same seven on
 * every screen that draws one. Measured in this screen's space, because the
 * bill is drawn smaller here than on a phone. */
export const zoomPoints = {
  customer: { x: 276, y: 230 },
  'mobile-number': { x: 276, y: 241 },
  'invoice-number': { x: 276, y: 191 },
  'invoice-date': { x: 392, y: 191 },
  'bill-items': { x: 334, y: 272 },
  totals: { x: 392, y: 357 },
  balance: { x: 392, y: 387 }
};

/* Fitting a tall document into a short pane.
 *
 * The bill is the phone's own markup at the phone's own width, and it is
 * taller than a laptop window is deep. It used to be drawn at a fixed 0.7
 * and simply ran off the bottom: the clip ended on a bill whose total was
 * cut through the middle, which is the one thing a billing video must not
 * do. The app scrolls that pane; a four-second shot cannot. So the sheet is
 * fitted to the pane instead - whole and small, rather than large and
 * guillotined - and the camera zooms onto whatever the recipe asks for,
 * which is what makes the small size affordable.
 *
 * MEASURED from a render. test/desktop-bill-fits.test.js measures all of it
 * again and fails if the layout drifts, because nothing on screen would say
 * so: the bill would just start hanging over the edge again. */
/* Where the sheet sits: the top of the pane, its centre line, and a floor a
 * few pixels short of the pane's own, because a sheet whose last hairline
 * lands exactly on the edge reads as cut off even when it is not. */
const PANE = { top: 115, bottom: 390, centreX: 318 };
/* The bill's own height, unscaled: a fixed head and foot, plus a row per
 * item. */
const BILL = { head: 518, row: 26 };
/* The scale zoomPoints above were measured at. */
export const DRAWN_AT = 0.7;
/* And where the sheet sat when they were measured. It has moved since: it
 * was centred with margin:auto, which gives a child wider than its parent no
 * margin at all, so the bill hung 16px right of the pane it was in, and its
 * own top margin collapsed out through the pane's edge. Rather than measure
 * seven points by hand again, they are read as offsets from the sheet's old
 * origin and re-anchored to its new one. */
const DRAWN_AT_ORIGIN = { top: 127, centreX: 334.5 };

export function billScale(data) {
  const items = Array.isArray(data?.items) ? data.items.length : 0;
  const tall = BILL.head + BILL.row * items;
  /* Never larger than it was drawn: a one-line bill should not balloon. */
  return Math.min(DRAWN_AT, (PANE.bottom - PANE.top) / tall);
}

/* The same seven places, wherever the sheet actually ended up. It scales
 * about the top of the pane and its own centre line, so every point keeps
 * its distance from those two in the sheet's own terms - which is what
 * keeps a zoom aimed at the customer's number on the customer's number,
 * whatever the bill's length did to the scale. */
export function zoomPointsFor(data) {
  const k = billScale(data) / DRAWN_AT;
  return Object.fromEntries(Object.entries(zoomPoints).map(([name, p]) => [name, {
    x: PANE.centreX + (p.x - DRAWN_AT_ORIGIN.centreX) * k,
    y: PANE.top + (p.y - DRAWN_AT_ORIGIN.top) * k
  }]));
}

export const tapEffects = {
  'record-payment': { paid: 1 },
  share: { sharing: 1 },
  'share-whatsapp': { sharing: 0 }
};

export function render(data, state) {
  const sums = summarise(data?.items ?? []);
  const inv = invoiceOf(data ?? {});
  const paid = Number(state?.paid ?? 0) > 0;
  const sharing = Number(state?.sharing ?? 0) > 0;
  const received = paid ? sums.total : 0;

  /* Download, Print and Share each carry a dropdown arrow in the real bar -
   * each one has a menu behind it - and the two e-document buttons sit between
   * them and Record Payment In. */
  const action = (label, icon, id, kind = '', menu = false) => `
    <div class="mb-vbtn ${kind}" ${id ? `id="${id}"` : ''}>
      ${icon ? `<span class="ico">${icons[icon](11)}</span>` : ''}${esc(label)}
      ${menu ? `<span class="ico mb-chev">${icons.chevDown(8)}</span>` : ''}
    </div>`;

  const money = (label, value, kind = '') => `
    <div class="mb-pay-row ${kind}"><span>${esc(label)}</span><span>${formatINR(value)}</span></div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Sales', 'Sales Invoices')}

  <div class="mb-main view">
    <div class="mb-top">
      <span class="ico">${icons.back(13)}</span>
      <div class="mb-title sm">Sales Invoice #${esc(String(inv.number))}</div>
      <span class="mb-status ${paid ? 'paid' : ''}">${paid ? 'Paid' : 'Unpaid'}</span>
    </div>

    <div class="mb-theme-strip" id="theme-store">
      <span class="mb-theme-txt">Bring a professional touch to every invoice with our <b>new theme designs</b></span>
      <span class="mb-theme-cta">Explore Now</span>
      <span class="ico mb-theme-x">${icons.close(10)}</span>
    </div>

    <div class="mb-vbar">
      ${action('Download PDF', 'download', 'download-pdf', '', true)}
      ${action('Print PDF', 'print', '', '', true)}
      ${action('Share', 'share', 'share', '', true)}
      ${action('Generate E-way Bill', '', '', 'link')}
      ${action('Generate e-Invoice', '', '', 'link')}
      ${action('Record Payment In', '', 'record-payment', 'primary')}
    </div>

    <div class="mb-view-body">
      <div class="mb-paper">
        <div class="mb-paper-fit" style="transform: scale(${billScale(data).toFixed(3)})">${billMarkup(data ?? {}, { ...state, appear: 1 })}</div>
      </div>

      ${sharing ? `
      <div class="mb-sharemenu">
        <div class="mb-share-k">Share this invoice</div>
        <div class="mb-share-i" id="share-whatsapp"><span class="ico">${icons.whatsapp(12)}</span>WhatsApp</div>
        <div class="mb-share-i"><span class="ico">${icons.share(12)}</span>Email</div>
        <div class="mb-share-i"><span class="ico">${icons.linkChain(12)}</span>Copy link</div>
      </div>` : ''}

      <!-- The real panel puts what the bill is worth at the top and what is
           still owed at the foot, with the empty middle between them: the two
           numbers a shopkeeper looks for are as far apart as the panel is
           tall, which is why they are easy to find. -->
      <div class="mb-payhist">
        <div class="mb-payhist-top">
          <div class="mb-payhist-k">Payment History<span class="ico mb-payhist-x">${icons.close(10)}</span></div>
          ${money('Invoice Amount', sums.total)}
          ${money('Initial Amount Received', 0)}
          ${paid ? `
            <div class="mb-paid-note">
              <span class="ico">${icons.check(12)}</span>Payment recorded
            </div>` : ''}
        </div>
        <div class="mb-payhist-foot">
          ${money('Total Amount Received', received)}
          ${money('Balance Amount', sums.total - received, paid ? 'done' : 'due')}
        </div>
      </div>
    </div>
  </div>
</div>`;
}
