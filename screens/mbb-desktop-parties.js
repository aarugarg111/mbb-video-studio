import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { ledger } from './mcf-data.js';
import { sidebar, topActions, referralStrip, pendingActions } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-parties';

/* myBillBook's Parties on a laptop (reference/frames/dmbb-7.png).
 *
 * Rebuilt. The first version was drawn from one frame and read it loosely: it
 * missed the referral strip under the title, the Mobile Number column, the
 * per-row menu, the sort arrows on the two sortable columns, and the Pending
 * Actions pill. The toolbar was wrong too - the real one is a small search
 * button and a category dropdown, not a wide search field.
 *
 * No real number appears in the Mobile column. Most rows in the recording show
 * a dash, and the ones that do carry a number carry a real one.
 */
export const device = 'desktop';

/* Where the camera rests. A 16:9 window inside a 9:16 video has to be pushed
 * in on to fill the picture, and what goes out of frame when it is should be
 * chrome rather than content - so the camera sits right of the rail. */
export const focus = { x: 423, y: 203 };
export const url = 'mybillbook.in/app/home/parties';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  /* The rail's own button, where a laptop bill starts. */
  'create-sales-invoice': { x: 63, y: 46 },
  'create-party': { x: 672, y: 166 },
  'to-collect': { x: 423, y: 118 },
  'party-row-0': { x: 423, y: 234 },
  'reports': { x: 607, y: 23 }
};

/* What fits above the floating Pending Actions pill in a 16:9 window. The
 * real table runs off the bottom of the page, so stopping short of the edge is
 * what it looks like; running under the pill is not. */
const ROWS = 6;

export function render(data, state) {
  const book = ledger(data);
  const business = data?.business?.name;
  /* A customer owes you; a supplier is owed. Alternating down the list is what
   * the real table looks like and keeps both columns meaningful. */
  /* The real table runs off the bottom of the window. Six rows left the pane
   * half empty. These stand-ins are invented - no name from the recording. */
  const FILL = [
    { name: 'Nagpal Provision Store', balance: 13298 },
    { name: 'Shanti Agencies', balance: 6652 },
    { name: 'Deepak Kirana', balance: 3652 },
    { name: 'M/S Barsainya & Sons', balance: 0 }
  ];
  /* The whole book, then as much of it as the window shows. The figures across
   * the top and the count beside "All Parties" are the book's, not the
   * window's: the real screen says 38 parties while showing eleven of them,
   * and a count that changed with the size of the window would be wrong. */
  const all = [...book.parties, ...FILL].map((p, i) => ({
    ...p,
    kind: i % 3 === 1 ? 'Supplier' : 'Customer'
  }));
  const rows = all.slice(0, ROWS);

  const toCollect = all.filter(p => p.kind === 'Customer').reduce((t, p) => t + p.balance, 0);
  const toPay = all.filter(p => p.kind === 'Supplier').reduce((t, p) => t + p.balance, 0);

  const card = (label, value, icon, kind, id) => `
    <div class="mb-stat ${kind}" ${id ? `id="${id}"` : ''}>
      <div class="mb-stat-k"><span class="ico">${icons[icon](11)}</span>${esc(label)}</div>
      <div class="mb-stat-v">${esc(value)}</div>
    </div>`;

  const row = (p, i) => `
    <div class="mb-row" ${i === 0 ? 'id="party-row-0"' : ''}>
      <div class="mb-c nm">${esc(p.name)}</div>
      <div class="mb-c cat">-</div>
      <div class="mb-c mob">-</div>
      <div class="mb-c kind">${esc(p.kind)}</div>
      <div class="mb-c bal ${p.kind === 'Customer' ? 'in' : 'out'}">
        <span class="ico">${p.kind === 'Customer' ? icons.arrowDown(10) : icons.arrowUp(10)}</span>${formatINR(p.balance)}
      </div>
      <div class="mb-c menu"><span class="ico">${icons.more(11)}</span></div>
    </div>`;

  const sortable = label => `${esc(label)} <span class="ico mb-sort">${icons.sliders(8)}</span>`;

  return `
<div class="screen mbscreen">
  ${sidebar(business, 'Parties', 'All Parties')}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title">Parties</div>
      ${topActions([
        { label: 'SharedLedger Portal', icon: 'linkChain', kind: 'ghost' },
        { label: 'Reports', icon: 'ledger', kind: 'ghost', id: 'reports', menu: true }
      ])}
    </div>

    ${referralStrip()}

    <div class="mb-stats">
      ${card('All Parties', String(all.length), 'group', 'all')}
      ${card('To Collect', formatINR(toCollect), 'rupeeCircle', 'collect', 'to-collect')}
      ${card('To Pay', formatINR(toPay), 'rupeeCircle', 'pay')}
    </div>

    <div class="mb-bar">
      <span class="mb-icobtn square">${icons.search(11)}</span>
      <div class="mb-select">Search Categories <span class="ico mb-chev">${icons.chevDown(9)}</span></div>
      <div class="mb-abtn ghost"><span class="ico">${icons.sliders(10)}</span>Bulk Action <span class="ico mb-chev">${icons.chevDown(9)}</span></div>
      <div class="mb-abtn primary" id="create-party">Create Party</div>
    </div>

    <div class="mb-head-row">
      <div class="mb-c nm">${sortable('Party Name')}</div>
      <div class="mb-c cat">Category</div>
      <div class="mb-c mob">Mobile Number</div>
      <div class="mb-c kind">Party type</div>
      <div class="mb-c bal">${sortable('Balance')}</div>
      <div class="mb-c menu"></div>
    </div>
    <div class="mb-rows">${rows.map(row).join('')}</div>
  </div>

  ${pendingActions()}
</div>`;
}
