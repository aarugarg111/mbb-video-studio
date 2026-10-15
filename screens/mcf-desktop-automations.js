import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short } from './mcf-data.js';
import { hostRail, mcfRail, topBar } from './mcf-desktop-chrome.js';
import { AUTOMATIONS } from './mcf-automations.js';

export const name = 'mcf-desktop-automations';

/* The automations, on a laptop (reference/frames/dmcf-38.png).
 *
 * This is where a collections clip has to end. Everything before it is one
 * phone call; this is the thing that keeps happening after the owner shuts the
 * laptop, and a video that never shows it has sold a phone call rather than a
 * system.
 *
 * The laptop lays it out as list-and-detail - the automations down the left,
 * and the one you picked open on the right with the parties it is chasing -
 * where the phone can only show the list and make you tap into one. Same
 * automations, same wording, read from the SAME list the phone screen uses so
 * the two shapes cannot disagree about what this business has running.
 */
export const device = 'desktop';
export const url = 'mycashflo.ai/automations';

export const focus = { x: 410, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'new-automation': { x: 387, y: 28 },
  'automation-0': { x: 325, y: 108 },
  'automation-1': { x: 325, y: 153 },
  'automation-2': { x: 325, y: 198 },
  'edit-automation': { x: 546, y: 120 },
  'edit-parties': { x: 635, y: 120 },
  'nav-parties': { x: 164, y: 77 },
  'nav-dashboard': { x: 164, y: 51 }
};

/* Which automation is open is the whole interaction on this page. */
export const tapEffects = {
  'automation-0': { picked: 0 },
  'automation-1': { picked: 1 },
  'automation-2': { picked: 2 }
};

export function render(data, state) {
  const book = ledger(data);
  const asking = Number(state?.asking ?? 0) > 0;
  /* The middle one is open when the page arrives, as in the recording. */
  const picked = Math.min(AUTOMATIONS.length - 1, Math.max(0, Number(state?.picked ?? 1)));
  const open = AUTOMATIONS[picked] ?? AUTOMATIONS[0];

  /* Who this automation is actually chasing. Derived from how overdue each
   * party is, so the count beside the automation and the rows underneath it
   * are the same parties - they were two unrelated numbers once, and the list
   * said "4 parties" over a table of one. */
  const chased = book.parties.filter(p => p.overdueDays > 0).slice(0, countOf(open, book));

  const item = (a, i) => `
    <div class="dka-item ${i === picked ? 'on' : ''}" id="automation-${i}">
      <span class="dka-ico ${a.via === 'phone' ? 'call' : 'wa'}">${icons[a.via === 'phone' ? 'phone' : 'whatsapp'](11)}</span>
      <div class="dka-item-txt">
        <div class="dka-item-k">${esc(a.window)}</div>
        <div class="dka-item-s">${esc(a.tone)} &#183; ${esc(a.when)}</div>
      </div>
      <span class="dka-count"><span class="ico">${icons.group(9)}</span>${countOf(a, book)}</span>
    </div>`;

  const row = p => `
    <div class="dka-row">
      <div class="dka-c who">
        <span class="dka-nm">${esc(p.name)}</span>
        <span class="dka-live"><span class="dk-dot"></span>Active</span>
      </div>
      <div class="dka-c amt">${short(p.balance)}</div>
      <div class="dka-c late">${p.overdueDays > 0 ? p.overdueDays + 'd overdue' : ''}</div>
    </div>`;

  return `
<div class="screen dkscreen">
  ${hostRail(data?.business?.name)}
  ${mcfRail('Automations', book.wallet)}

  <div class="dk-main">
    ${topBar('Automations', { label: 'New Automation', id: 'new-automation' }, asking)}

    <div class="dka-body">
      <div class="dka-list">
        <div class="dka-k">ACTIVE AUTOMATIONS (${AUTOMATIONS.length})</div>
        ${AUTOMATIONS.map(item).join('')}
      </div>

      <div class="dka-detail">
        <div class="dka-detail-top">
          <span class="dka-ico call big">${icons.phone(14)}</span>
          <div class="dka-detail-txt">
            <div class="dka-detail-k">${esc(open.window)}</div>
            <div class="dka-detail-s">${esc(open.tone)} &#183; ${esc(open.when)} &#183; ${chased.length} ${chased.length === 1 ? 'party' : 'parties'}</div>
          </div>
        </div>
        <div class="dka-acts">
          <div class="dka-act" id="edit-automation"><span class="ico">${icons.edit(10)}</span>Edit Automation</div>
          <div class="dka-act" id="edit-parties"><span class="ico">${icons.group(10)}</span>Edit parties</div>
        </div>

        <div class="dka-table">
          <div class="dka-row head">
            <div class="dka-c who">Party</div>
            <div class="dka-c amt">Amount</div>
            <div class="dka-c late">Aging</div>
          </div>
          ${chased.map(row).join('')}
        </div>
      </div>
    </div>
  </div>
</div>`;
}

/* How many parties an automation covers. The windows do not overlap, so each
 * one takes the slice of the book that falls inside it. */
function countOf(a, book) {
  const days = book.parties.map(p => p.overdueDays);
  if (/1 day to 1 month/i.test(a.window)) return days.filter(d => d > 0 && d <= 31).length || 1;
  if (/3 to 6 months|6m\+|6 months/i.test(a.window)) return days.filter(d => d > 90).length || 1;
  return days.filter(d => d > 31 && d <= 90).length || 1;
}
