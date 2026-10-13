import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short, rupeesExact } from './mcf-data.js';

export const name = 'mcf-desktop';

/* myCashFlo on a laptop (reference/frames/dsk-mcf-10.png), where the whole
 * book is on one screen instead of a list you scroll.
 *
 * This one IS rebuilt from a recording, unlike the invented myCashFlo screens.
 * Two things in the frame are the product's real AI, and both are here: the
 * "Talk to AI Accountant" bar across the top, which takes an instruction in
 * plain Hinglish, and the New Call Follow-Up sheet that sets one up.
 *
 * Every party is invented. The recording is of a real shop and its desktop
 * screens carry real names and a real phone number, same as the phone ones.
 */
export const device = 'desktop';
export const url = 'app.mycashflo.in/parties';

/* Coordinates are in the desktop's own 720x450 space - NOT the phone's
 * 390x844 - and are MEASURED. */
export const targets = {
  'ask-ai': { x: 557, y: 36 },
  'setup-automation': { x: 281, y: 36 },
  'party-row-0': { x: 424, y: 179 },
  'continue': { x: 360, y: 337 }
};

/* Opening the sheet is the beat: the owner tells the app to start chasing. */
export const tapEffects = {
  'setup-automation': { sheet: 1 },
  'ask-ai': { asking: 1 }
};

const NAV = [
  ['Dashboard', 'mcfDashboard'], ['Parties', 'mcfParties'],
  ['History', 'clock'], ['Automations', 'mcfAutomations'], ['Settings', 'settings']
];

const FILTERS = ['Overdue', 'Due Soon', 'Balance', 'Category'];

/* What the AI is told to do, in the owner's own words - the frame shows
 * exactly this kind of instruction sitting in the bar. */
export const ASK = 'Sabse purane overdue parties pe calling start karo';

export function render(data, state) {
  const book = ledger(data);
  const sheet = Number(state?.sheet ?? 0) > 0;
  const asking = Number(state?.asking ?? 0) > 0;
  const rows = book.parties.slice(0, 7);

  const row = (p, i) => `
    <div class="dk-row" ${i === 0 ? 'id="party-row-0"' : ''}>
      <div class="dk-c name">${esc(p.name)}</div>
      <div class="dk-c amt">${short(p.balance)}</div>
      <div class="dk-c late">${p.overdueDays > 0 ? p.overdueDays + 'd' : '&#8212;'}</div>
      <div class="dk-c auto">
        ${p.standby > 0
          ? `<span class="dk-pill"><span class="dk-dot"></span>Standby (${p.standby})</span>`
          : '<span class="dk-off">Off</span>'}
      </div>
      <div class="dk-c seen">&#8212;</div>
    </div>`;

  return `
<div class="screen dkscreen">
  <div class="dk-side">
    <div class="dk-brand">myCashFlo</div>
    ${NAV.map(([label, ic], i) => `
      <div class="dk-nav ${i === 1 ? 'on' : ''}">
        <span class="ico">${icons[ic](14)}</span>${label}
      </div>`).join('')}
    <div class="dk-credits">
      <div class="dk-credits-k">CREDITS</div>
      <div class="dk-credits-v">${rupeesExact(Math.floor(book.wallet)).replace('.00', '')}</div>
    </div>
  </div>

  <div class="dk-main">
    <div class="dk-top">
      <div class="dk-title">Parties</div>
      <div class="dk-btn" id="setup-automation"><span class="ico">${icons.plus(12)}</span>Setup Automation</div>
      <div class="dk-ai ${asking ? 'on' : ''}" id="ask-ai">
        <span class="dk-ai-wave">${icons.dots(14)}</span>
        <div class="dk-ai-txt">
          <div class="dk-ai-ttl">Talk to AI Accountant</div>
          <div class="dk-ai-said">&#8220;${esc(ASK)}&#8221;</div>
        </div>
        <span class="ico">${icons.mic(16)}</span>
      </div>
    </div>

    <div class="dk-filters">
      <div class="dk-search"><span class="ico">${icons.search(12)}</span>Search party name, company, phone...</div>
      ${FILTERS.map(f => `<div class="dk-filter">${esc(f)} ${icons.chevDown(10)}</div>`).join('')}
    </div>

    <div class="dk-head">
      <div class="dk-c name">PARTY</div>
      <div class="dk-c amt">OUTSTANDING</div>
      <div class="dk-c late">OVERDUE</div>
      <div class="dk-c auto">AUTOMATIONS</div>
      <div class="dk-c seen">LAST ACTIVITY</div>
    </div>
    <div class="dk-rows">${rows.map(row).join('')}</div>
  </div>

  ${sheet ? `
    <div class="dk-scrim"></div>
    <div class="dk-sheet">
      <div class="dk-sheet-head">
        <span class="mcf-round">${icons.phone(14)}</span>
        <div>
          <div class="dk-sheet-ttl">New Call Follow-Up</div>
          <div class="dk-sheet-sub">Step 1 of 2 &#183; Configure</div>
        </div>
        <span class="ico dk-x">${icons.close(14)}</span>
      </div>

      <div class="dk-field-k">WHEN SHOULD WE FOLLOW UP WITH PARTIES?</div>
      <div class="dk-field">
        <div>
          <div class="dk-field-v">Very late</div>
          <div class="dk-field-s">3 to 6 months late</div>
        </div>
        <span class="ico">${icons.chevDown(12)}</span>
      </div>

      <div class="dk-field-k">FREQUENCY</div>
      <div class="dk-field">
        <div class="dk-field-v">Daily</div>
        <span class="ico">${icons.chevDown(12)}</span>
      </div>

      <div class="dk-go" id="continue">Continue &#183; Select parties</div>
    </div>` : ''}
</div>`;
}
