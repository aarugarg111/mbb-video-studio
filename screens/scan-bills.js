import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';

export const name = 'scan-bills';

/* Measured against a render. */
export const targets = {
  'open-camera': { x: 249, y: 799 },
  'upload-pdf': { x: 121, y: 799 },
  'browse-gallery': { x: 330, y: 126 }
};

/* Where Scan & Record starts (reference/frames/scan-t58.png): what has been
 * scanned before, and the two ways to add another.
 *
 * The gallery strip in the reference is photographs of real invoices from the
 * owner's own phone, so these are blank document tiles instead. The caption
 * under them is the app's own - it has not read them yet, so it does not know
 * whose they are. */
/* Exported so the laptop's Scan & Record shows the SAME history. Two copies
 * of this list would drift, and one business would have scanned two different
 * sets of bills depending on which shape the reel was cut in. */
export const RECENT = [
  { party: 'Cash Sale', doc: 32, items: 3, amount: 8436, done: true },
  { party: 'Cash Sale', doc: 31, items: 3, amount: 8436, done: true },
  { party: 'Vikram Stores', doc: 30, items: 4, amount: 8594.87, done: true },
  { party: 'Vikram Stores', doc: 29, items: 2, amount: 4120, done: false }
];

export function render(data, state) {
  const scanned = Number(state?.scanned ?? 21);

  const tile = i => `
    <div class="sbtile">
      <div class="sbthumb"><i></i><i></i><i></i><i></i></div>
      <div class="sbcap">Unknown Party</div>
    </div>`;

  const card = r => `
    <div class="sbcard">
      <div class="sbtop">
        <span class="sbparty">${esc(r.party)}</span>
        <span class="sbpill ${r.done ? 'done' : 'open'}">${r.done ? 'Completed' : 'Incomplete'}</span>
      </div>
      <div class="sbdoc">Purchase Invoice #${r.doc}</div>
      <div class="sbfoot">
        <span>19 Apr 2026 &#160;&#183;&#160; ${r.items} items</span>
        <span class="sbamt">${formatINR(r.amount)}</span>
      </div>
    </div>`;

  return `
<div class="screen sbscreen">
  <div class="appbar">
    <span class="ico">${icons.back(24)}</span>
    <div class="titles"><h1>Scan &amp; Record Bills</h1></div>
  </div>

  <div class="sbstrip">
    <span class="sbstat"><span class="ico">${icons.docSettings(17)}</span><b>${scanned}</b> bills scanned</span>
    <span class="sbrule"></span>
    <span class="sbstat"><span class="ico">${icons.info(16)}</span><b>~1.8</b> hours saved</span>
  </div>

  <div class="sbhead">
    <span>Invoices From Gallery</span>
    <span class="sblink" id="browse-gallery">Browse Gallery &#8250;</span>
  </div>
  <div class="sbtiles">${[0, 1, 2, 3].map(tile).join('')}</div>

  <div class="sbsection">Recent Scans</div>
  <div class="fpills sbpills">
    <div class="fp">Invoice Type ${icons.chevDown(14)}</div>
    <div class="fp">Incompleted</div>
    <div class="fp">Completed</div>
  </div>

  <div class="sbdate">26 Apr 2026</div>
  <div class="sblist">${RECENT.map(card).join('')}</div>

  <div class="floatbtns sbbtns">
    <div class="fb bulk" id="upload-pdf">Upload PDF</div>
    <div class="fb create" id="open-camera"><span class="ico">${icons.camera(19)}</span>Open Camera</div>
  </div>
</div>`;
}
