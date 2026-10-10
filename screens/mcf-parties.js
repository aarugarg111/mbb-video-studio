import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short, rupeesExact } from './mcf-data.js';
import { MCF_NAV, walletPill, supportPill } from './mcf-chrome.js';

export const name = 'mcf-parties';

/* myCashFlo's Parties list (reference/frames/mcf-25.png): everyone who owes,
 * biggest first, with how late they are. Coordinates are MEASURED. */
export const targets = {
  'setup-automation': { x: 195, y: 86 },
  'search': { x: 195, y: 141 },
  'filter-overdue': { x: 62, y: 190 },
  'party-row-0': { x: 195, y: 263 },
  'party-row-1': { x: 195, y: 353 },
  'nav-dashboard': { x: 38, y: 810 },
  'nav-automations': { x: 277, y: 810 }
};

const FILTERS = ['Overdue', 'Due Soon', 'Balance', 'Cat'];

export function render(data, state) {
  const book = ledger(data);

  const row = (p, i) => `
    <div class="mcf-prow" id="party-row-${i}">
      <div class="mcf-prow-top">
        <div class="mcf-prow-nm">${esc(p.name)}</div>
        <div class="mcf-prow-right">
          <div class="mcf-prow-amt">${short(p.balance)}</div>
          ${p.overdueDays > 0 ? `<div class="mcf-prow-late">${p.overdueDays}d overdue</div>` : ''}
        </div>
      </div>
      <div class="mcf-standby"><span class="mcf-standby-dot"></span>Standby (${p.standby})</div>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar plain">
    <div class="mcf-title">Parties</div>
    ${walletPill(book.wallet, rupeesExact)}
  </div>

  <div class="mcf-body">
    <div class="mcf-btn wide" id="setup-automation"><span class="ico">${icons.plus(15)}</span>Setup Automation</div>

    <div class="mcf-search" id="search">
      <span class="ico">${icons.search(16)}</span>Search party name, company, phone...
    </div>

    <div class="mcf-filters">
      ${FILTERS.map((f, i) => `
        <div class="mcf-filter" ${i === 0 ? 'id="filter-overdue"' : ''}>${esc(f)} ${icons.chevDown(12)}</div>`).join('')}
    </div>

    <div class="mcf-plist">${book.parties.slice(0, 5).map(row).join('')}</div>
  </div>

  ${supportPill()}
  ${MCF_NAV('parties')}
</div>`;
}
