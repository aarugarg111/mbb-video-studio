import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

/* The parts every myBillBook desktop screen carries: the left rail and the
 * row of actions across the top.
 *
 * Rebuilt from reference/frames/dsk-mbb-4.png and dsk-mbb-28.png. The real
 * rail has about twenty entries under four headings; at 720 logical pixels
 * only the ones a script would ever point at fit, so this is the shape of it
 * rather than every line. Shrinking all twenty to fit would make a rail nobody
 * can read, which is worse than an honest selection.
 *
 * The real sidebar shows the owner's phone number under the business name.
 * It is left out here: the recording's is a real number, and an invented one
 * is somebody else's.
 */

export const NAV = [
  ['GENERAL', [
    ['Dashboard', 'mcfDashboard'],
    ['Parties', 'mcfParties'],
    ['Items', 'navItems'],
    ['Sales', 'docSettings'],
    ['Purchases', 'folderUp'],
    ['Reports', 'ledger']
  ]],
  ['BUSINESS TOOLS', [
    ['AI Collections', 'phone', 'New']
  ]]
];

export function sidebar(business, active) {
  const item = ([label, icon, tag]) => `
    <div class="mb-nav ${label === active ? 'on' : ''}">
      <span class="ico">${icons[icon](12)}</span>${esc(label)}
      ${tag ? `<span class="mb-new">${esc(tag)}</span>` : ''}
    </div>`;

  return `
  <div class="mb-side">
    <div class="mb-biz">
      <span class="mb-avatar">${esc(String(business || 'B').trim().charAt(0).toUpperCase())}</span>
      <span class="mb-biz-nm">${esc(business || 'Your Business')}</span>
    </div>
    <div class="mb-create"><span class="ico">${icons.plus(11)}</span>Create Sales Invoice</div>
    ${NAV.map(([heading, items]) => `
      <div class="mb-head">${esc(heading)}</div>
      ${items.map(item).join('')}`).join('')}
    <div class="mb-side-foot">
      <span class="ico">${icons.settings(11)}</span>Settings
    </div>
  </div>`;
}

/* Mira AI reading a bill into a form. It sits on both Create Sales Invoice
 * and Create Purchase Invoice, which is why it lives here: two copies would
 * drift, and the drift would be two ads describing the same feature
 * differently.
 *
 * The counters are fixed rather than derived - they are the shop's running
 * total, not anything this bill changes, and a number that moved between
 * renders would make two renders of one recipe different files. */
export const SCANNED = 22;
export const HOURS_SAVED = '1.8';

export function miraPanel(filled) {
  return `<div class="mb-ai-panel">
      <div class="mb-ai-head">
        <span class="mb-ai-mark">${icons.scan(14)}</span>
        <div>
          <div class="mb-ai-ttl">Autofill this bill</div>
          <div class="mb-ai-sub">Powered by Mira AI</div>
        </div>
      </div>

      <div class="mb-ai-stats">
        <span><b>${SCANNED}</b> bills scanned</span>
        <span>~<b>${HOURS_SAVED} hrs</b> saved</span>
      </div>

      <div class="mb-drop ${filled ? 'done' : ''}" id="upload">
        <span class="ico">${filled ? icons.check(18) : icons.folderUp(18)}</span>
        ${filled ? 'Bill read' : 'Drag &amp; Drop or Upload file'}
        <div class="mb-drop-s">${filled ? 'Fields filled from the bill' : 'PDF, JPG, PNG &#183; max 5MB'}</div>
      </div>

      <div class="mb-proceed" id="proceed">Proceed</div>

      <div class="mb-how">
        <div class="mb-how-k">How it works</div>
        <div class="mb-how-i"><span class="ico">${icons.folderUp(10)}</span>Upload invoice document</div>
        <div class="mb-how-i"><span class="ico">${icons.scan(10)}</span>AI scans &amp; extracts data</div>
        <div class="mb-how-i"><span class="ico">${icons.check(10)}</span>Fields auto-filled instantly</div>
      </div>
    </div>`;
}

/* The buttons that sit to the right of a screen's title. */
export function topActions(buttons) {
  return `
  <div class="mb-actions">
    ${buttons.map(b => `
      <div class="mb-abtn ${b.kind ?? ''}" ${b.id ? `id="${b.id}"` : ''}>
        ${b.icon ? `<span class="ico">${icons[b.icon](11)}</span>` : ''}${esc(b.label)}
      </div>`).join('')}
  </div>`;
}
