import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { ledger } from './mcf-data.js';
import { sidebar, topActions } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-parties';

/* myBillBook's Parties on a laptop (reference/frames/dsk-mbb-4.png): everyone
 * you deal with in one table, with what they owe and what you owe them.
 *
 * The phone's Parties screen shows a card per party and fits five. This shows
 * the counts across the top and a table under them, which is the reason to
 * film a laptop at all.
 *
 * The book comes from the same ledger myCashFlo reads, so a script that moves
 * between the two products does not change its own figures halfway.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/parties';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  'create-party': { x: 665, y: 133 },
  'to-collect': { x: 431, y: 80 },
  'party-row-0': { x: 431, y: 210 },
  'reports': { x: 667, y: 26 }
};

export function render(data, state) {
  const book = ledger(data);
  const business = data?.business?.name;
  /* A customer owes you; a supplier is owed. Alternating down the list is what
   * the real table looks like and keeps both columns meaningful. */
  const rows = book.parties.slice(0, 7).map((p, i) => ({
    ...p,
    kind: i % 3 === 1 ? 'Supplier' : 'Customer'
  }));

  const toCollect = rows.filter(p => p.kind === 'Customer').reduce((t, p) => t + p.balance, 0);
  const toPay = rows.filter(p => p.kind === 'Supplier').reduce((t, p) => t + p.balance, 0);

  const card = (label, value, icon, kind) => `
    <div class="mb-stat ${kind}" ${kind === 'collect' ? 'id="to-collect"' : ''}>
      <div class="mb-stat-k"><span class="ico">${icons[icon](11)}</span>${esc(label)}</div>
      <div class="mb-stat-v">${esc(value)}</div>
    </div>`;

  const row = (p, i) => `
    <div class="mb-row" ${i === 0 ? 'id="party-row-0"' : ''}>
      <div class="mb-c nm">${esc(p.name)}</div>
      <div class="mb-c cat">&#8212;</div>
      <div class="mb-c kind">${esc(p.kind)}</div>
      <div class="mb-c bal ${p.kind === 'Customer' ? 'in' : 'out'}">
        <span class="ico">${p.kind === 'Customer' ? icons.arrowDown(10) : icons.arrowUp(10)}</span>${formatINR(p.balance)}
      </div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(business, 'Parties')}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Parties</div>
      ${topActions([
        { label: 'SharedLedger Portal', icon: 'linkChain', kind: 'ghost' },
        { label: 'Reports', icon: 'ledger', kind: 'ghost', id: 'reports' }
      ])}
    </div>

    <div class="mb-stats">
      ${card('All Parties', String(rows.length), 'group', 'all')}
      ${card('To Collect', formatINR(toCollect), 'rupeeCircle', 'collect')}
      ${card('To Pay', formatINR(toPay), 'rupeeCircle', 'pay')}
    </div>

    <div class="mb-bar">
      <div class="mb-search"><span class="ico">${icons.search(11)}</span>Search Categories</div>
      <div class="mb-abtn ghost"><span class="ico">${icons.sliders(11)}</span>Bulk Action</div>
      <div class="mb-abtn primary" id="create-party">Create Party</div>
    </div>

    <div class="mb-head-row">
      <div class="mb-c nm">Party Name</div>
      <div class="mb-c cat">Category</div>
      <div class="mb-c kind">Party type</div>
      <div class="mb-c bal">Balance</div>
    </div>
    <div class="mb-rows">${rows.map(row).join('')}</div>
  </div>
</div>`;
}
