import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { sidebar } from './mbb-desktop-chrome.js';
import { RECENT } from './scan-bills.js';

export const name = 'mbb-desktop-scan';

/* Scan & Record on a laptop - the same feature as the phone's, and the same
 * flow, in the interface a laptop actually gives you.
 *
 * The phone's version offers a camera. A laptop has no camera worth pointing
 * at a bill, so the app's two ways in are the two a desktop has: drop a file
 * on the window, or send the photo across from the phone in your hand. That
 * second one is the counterpart of the phone's "Open Camera" - the same step
 * of the same flow, done the way a desktop does it.
 *
 * The list of what has been scanned before is the SAME list the phone screen
 * shows, imported rather than copied, so the two shapes cannot disagree about
 * what this business has already put through.
 *
 * DISCLOSED: no reference frame of this page exists. Its pieces are the phone
 * screen's, laid out the way the app lays out its other laptop pages. It looks
 * right; it may not be right.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/scan-and-record';

export const focus = { x: 423, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'create-sales-invoice': { x: 63, y: 45 },
  'upload-file': { x: 280, y: 92 },
  'browse-files': { x: 307, y: 111 },
  'add-from-phone': { x: 564, y: 92 },
  'read-bill': { x: 658, y: 164 },
  'scan-row-0': { x: 423, y: 195 }
};

/* Picking a way in is the beat: the window changes from "add a bill" to "here
 * is the bill, read it". Either route arrives at the same place, which is the
 * point - it does not matter how the picture got here. */
export const tapEffects = {
  'upload-file': { source: 'file' },
  'browse-files': { source: 'file' },
  'add-from-phone': { source: 'phone' },
  'read-bill': { reading: 1 }
};

export function render(data, state) {
  const source = state?.source ?? '';
  const picked = source === 'file' || source === 'phone';
  const scanned = Number(state?.scanned ?? 21);

  const row = (r, i) => `
    <div class="dsc-row" ${i === 0 ? 'id="scan-row-0"' : ''}>
      <div class="dsc-c party">${esc(r.party)}</div>
      <div class="dsc-c doc">Purchase Invoice #${esc(String(r.doc))}</div>
      <div class="dsc-c lines">${Number(r.items)} items</div>
      <div class="dsc-c amt">${formatINR(r.amount)}</div>
      <div class="dsc-c stat">
        <span class="mb-pill ${r.done ? 'done' : 'open'}">${r.done ? 'Completed' : 'Incomplete'}</span>
      </div>
    </div>`;

  /* What the drop zone says once something is in it. A file arrives named; a
   * photo from the phone arrives as a photo, which is what the owner sees. */
  const dropped = source === 'file'
    ? { icon: 'pdfFile', title: 'purchase-invoice.pdf', sub: 'Ready to read' }
    : { icon: 'camera', title: 'Photo from your phone', sub: 'Received just now' };

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Purchases', 'Scan & Record')}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Scan &amp; Record Bills</div>
      <div class="dsc-stats">
        <span><span class="ico">${icons.docSettings(11)}</span><b>${scanned}</b> bills scanned</span>
        <span><span class="ico">${icons.info(11)}</span>~<b>1.8</b> hours saved</span>
      </div>
    </div>

    <div class="dsc-ways">
      <div class="dsc-drop ${picked ? 'done' : ''}" id="upload-file">
        ${picked ? `
          <span class="ico big">${icons[dropped.icon](22)}</span>
          <div class="dsc-drop-k">${esc(dropped.title)}</div>
          <div class="dsc-drop-s">${esc(dropped.sub)}</div>
        ` : `
          <span class="ico big">${icons.folderUp(22)}</span>
          <div class="dsc-drop-k">Drag a bill here</div>
          <div class="dsc-drop-s">PDF or image &#183; <span class="dsc-link" id="browse-files">browse files</span></div>
        `}
      </div>

      <div class="dsc-or">or</div>

      <!-- The laptop's answer to the phone's camera: the bill is in your hand,
           the screen is on the desk, so the phone sends the picture over. -->
      <div class="dsc-phone ${source === 'phone' ? 'on' : ''}" id="add-from-phone">
        <div class="dsc-qr">${source === 'phone' ? `<span class="ico">${icons.check(20)}</span>` : '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>'}</div>
        <div class="dsc-phone-txt">
          <div class="dsc-drop-k">${source === 'phone' ? 'Photo received' : 'Add image from phone'}</div>
          <div class="dsc-drop-s">${source === 'phone'
            ? 'Sent from your phone'
            : 'Scan this code with your phone and photograph the bill'}</div>
        </div>
      </div>
    </div>

    ${picked ? `
      <div class="dsc-go">
        <div class="mb-abtn primary" id="read-bill">Read this bill</div>
      </div>` : ''}

    <div class="dsc-table">
      <div class="dsc-row head">
        <div class="dsc-c party">Party</div>
        <div class="dsc-c doc">Document</div>
        <div class="dsc-c lines">Items</div>
        <div class="dsc-c amt">Amount</div>
        <div class="dsc-c stat">Status</div>
      </div>
      ${RECENT.map(row).join('')}
    </div>
  </div>
</div>`;
}
