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
