import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short, rupeesExact } from './mcf-data.js';

export const name = 'mcf-desktop';

/* myCashFlo on a laptop (reference/frames/dmcf-3.png and dsk-mcf-10.png).
 *
 * Rebuilt. The first version got the shape of the page wrong in a way that
 * mattered: myCashFlo is not a separate site, it is reached from inside
 * myBillBook as "AI Collections", so the page carries TWO rails - myBillBook's
 * down the far left with AI Collections lit, and myCashFlo's own beside it.
 * It also missed the two columns that make the table worth filming: what is
 * being done about each party (Promise Breached, a daily WhatsApp reminder,
 * Standby) and what the AI last did about it.
 *
 * Every party is invented. The recording carries real names, real phone
 * numbers and real call notes.
 */
export const device = 'desktop';

/* Where the camera rests. A 16:9 window inside a 9:16 video has to be pushed
 * in on to fill the picture, and what goes out of frame when it is should be
 * chrome rather than content - so the camera sits right of the rail. */
/* This screen carries two rails - myBillBook's and myCashFlo's own - so the
 * camera sits further left than on a myBillBook screen: far enough to lose
 * myBillBook's rail, not so far that it clips the word "myCashFlo". */
export const focus = { x: 410, y: 203 };
export const url = 'app.mycashflo.in/parties';

/* Coordinates are in the desktop's 720x540 space and are MEASURED. */
export const targets = {
  'ask-ai': { x: 585, y: 28 },
  'setup-automation': { x: 346, y: 28 },
  'party-row-0': { x: 468, y: 110 },
  /* Measured with the follow-up sheet open - it does not exist before that,
   * which is why measure-targets.mjs reports it missing in the default state. */
  /* This was 67px below the button it names, so the tap that moves the sheet
   * on to step 2 landed under it. Nothing failed - the ripple simply appeared
   * in the wrong place, and the sheet changed anyway because the timeline
   * applies the effect whether or not the coordinates are any good. */
  'lang-hindi': { x: 234, y: 280 },
  'lang-english': { x: 280, y: 280 },
  'lang-hinglish': { x: 330, y: 280 },
  'tone-friendly': { x: 240, y: 314 },
  'tone-assertive': { x: 295, y: 314 },
  'tone-final': { x: 357, y: 314 },
  'tone-legal': { x: 424, y: 314 },
  'continue': { x: 360, y: 343 },
  /* Step 2's own buttons, which exist only once Continue has been tapped. */
  'select-all': { x: 234, y: 189 },
  'party-pick-0': { x: 360, y: 224 },
  'party-pick-1': { x: 360, y: 264 },
  activate: { x: 360, y: 383 }
};

export const tapEffects = {
  'setup-automation': { followup: 1 },
  'ask-ai': { asking: 1 },
  /* Step 1 configures the window and the frequency; step 2 picks the parties
   * and turns it on. Both are the same sheet, as in the app. */
  'lang-hindi': { language: 'Hindi' },
  'lang-english': { language: 'English' },
  'lang-hinglish': { language: 'Hinglish' },
  'tone-friendly': { tone: 'Friendly' },
  'tone-assertive': { tone: 'Assertive' },
  'tone-final': { tone: 'Final Notice' },
  'tone-legal': { tone: 'Legal Action' },
  continue: { step: 2 },
  'select-all': { all: 1 },
  activate: { followup: 0, live: 1 }
};

/* myBillBook's own rail, trimmed to what fits at this width. AI Collections is
 * the lit one, because that is how this page is reached. */
const HOST_NAV = [
  ['GENERAL', [
    ['Dashboard', 'mcfDashboard'], ['Parties', 'mcfParties'],
    ['Items', 'navItems'], ['Sales', 'docSettings'], ['Reports', 'ledger']
  ]],
  ['BUSINESS TOOLS', [['AI Collections', 'phone', true]]]
];

const MCF_NAV = [
  ['Dashboard', 'mcfDashboard'], ['Parties', 'mcfParties'],
  ['History', 'clock'], ['Automations', 'mcfAutomations'], ['Settings', 'settings']
];

const FILTERS = ['Overdue', 'Due Soon', 'Balance', 'Category'];

/* The same choices the phone's mcf-new-automation offers, under the same
 * names, so a shot list recast between the two shapes keeps its taps. */
const LANGUAGES = [
  { id: 'lang-hindi', label: 'Hindi' },
  { id: 'lang-english', label: 'English' },
  { id: 'lang-hinglish', label: 'Hinglish' },
  { id: null, label: 'Tamil' }
];

const TONES = [
  { id: 'tone-friendly', label: 'Friendly' },
  { id: 'tone-assertive', label: 'Assertive' },
  { id: 'tone-final', label: 'Final Notice' },
  { id: 'tone-legal', label: 'Legal Action' }
];

/* What the AI is told to do, in the owner's own words - the bar carries
 * exactly this kind of instruction. */
export const ASK = 'Sabse purane overdue parties pe calling start karo';

/* What the AI last did, per party. The recording shows short notes against a
 * few rows and nothing against the rest, which is what a real book looks like:
 * most parties have had nothing happen to them yet. */
const ACTIVITY = ['Call hui, payment ka wada liya', '', 'Reminder bheja gaya', '', '', ''];

/* How each party is being chased, in the app's own words. */
export function chaseOf(party, i) {
  if (party.overdueDays > 180) return { kind: 'breach', label: 'Promise Breached' };
  if (i === 2) return { kind: 'daily', label: 'Daily' };
  if (party.standby > 0) return { kind: 'standby', label: `Standby (${party.standby})` };
  return { kind: 'off', label: 'Off' };
}

export function render(data, state) {
  const book = ledger(data);
  const business = data?.business?.name || 'Your Business';
  /* NOT "sheet": that name belongs to the timeline's own sheet-slide, which
   * ramps to 1 by itself. This one only opens when the button is tapped. */
  const sheet = Number(state?.followup ?? 0) > 0;
  const step = Number(state?.step ?? 1) >= 2 ? 2 : 1;
  const all = Number(state?.all ?? 0) > 0;
  const language = state?.language ?? 'Hindi';
  const tone = state?.tone ?? 'Friendly';
  const asking = Number(state?.asking ?? 0) > 0;
  const rows = book.parties.slice(0, 6);

  const hostItem = ([label, icon, lit]) => `
    <div class="dk-hnav ${lit ? 'on' : ''}">
      <span class="ico">${icons[icon](11)}</span>${esc(label)}
      ${lit ? '<span class="dk-new">New</span>' : ''}
    </div>`;

  const row = (p, i) => {
    const how = chaseOf(p, i);
    const note = ACTIVITY[i] ?? '';
    return `
    <div class="dk-row" ${i === 0 ? 'id="party-row-0"' : ''}>
      <div class="dk-c who">
        <div class="dk-nm">${esc(p.name)}</div>

      </div>
      <div class="dk-c state">
        ${how.kind === 'breach' ? `<span class="dk-chip breach">${esc(how.label)}</span>` : ''}
      </div>
      <div class="dk-c amt">${short(p.balance)}</div>
      <div class="dk-c late">${p.overdueDays > 0 ? p.overdueDays + 'd overdue' : ''}</div>
      <div class="dk-c auto">
        ${how.kind === 'daily'
          ? `<span class="dk-chip daily"><span class="ico">${icons.whatsapp(9)}</span>${esc(how.label)}</span>`
          : how.kind === 'standby'
            ? `<span class="dk-chip standby"><span class="dk-dot"></span>${esc(how.label)}</span>`
            : '<span class="dk-off">Off</span>'}
      </div>
      <div class="dk-c seen">
        ${note
          ? `<div class="dk-note">${esc(note)}</div><div class="dk-ago">3 months ago</div>`
          : '<span class="dk-off">&#8212;</span>'}
      </div>
    </div>`;
  };

  return `
<div class="screen dkscreen">
  <div class="dk-host">
    <div class="dk-host-biz">
      <span class="dk-avatar">${esc(String(business).trim().charAt(0).toUpperCase())}</span>
      <span class="dk-host-nm">${esc(business)}</span>
    </div>
    <div class="dk-host-cta"><span class="ico">${icons.plus(9)}</span>Create Sales Invoice</div>
    ${HOST_NAV.map(([head, items]) => `
      <div class="dk-head-k">${esc(head)}</div>
      ${items.map(hostItem).join('')}`).join('')}
  </div>

  <div class="dk-side">
    <div class="dk-brand">myCashFlo</div>
    ${MCF_NAV.map(([label, ic], i) => `
      <div class="dk-nav ${i === 1 ? 'on' : ''}">
        <span class="ico">${icons[ic](11)}</span>${esc(label)}
      </div>`).join('')}
    <div class="dk-credits">
      <div class="dk-credits-k">CREDITS</div>
      <div class="dk-credits-v">${rupeesExact(Math.floor(book.wallet)).replace('.00', '')}</div>
    </div>
  </div>

  <div class="dk-main">
    <div class="dk-top">
      <div class="dk-title">Parties</div>
      <div class="dk-btn" id="setup-automation"><span class="ico">${icons.plus(10)}</span>Setup Automation</div>
      <div class="dk-ai ${asking ? 'on' : ''}" id="ask-ai">
        <span class="dk-ai-wave">${icons.dots(11)}</span>
        <div class="dk-ai-txt">
          <div class="dk-ai-ttl">Talk to AI Accountant</div>
          <div class="dk-ai-said">&#8220;${esc(ASK)}&#8221;</div>
        </div>
        <span class="dk-ai-mic">${icons.mic(12)}</span>
      </div>
    </div>

    <div class="dk-filters">
      <div class="dk-search"><span class="ico">${icons.search(10)}</span>Search party name, company, phone...</div>
      ${FILTERS.map(f => `<div class="dk-filter">${esc(f)} ${icons.chevDown(8)}</div>`).join('')}
      <div class="dk-filter"><span class="ico">${icons.filter(9)}</span>More</div>
    </div>

    <div class="dk-rows">${rows.map(row).join('')}</div>
  </div>

  ${sheet ? `
    <div class="dk-scrim"></div>
    <div class="dk-sheet">
      <div class="dk-sheet-head">
        ${step === 2 ? `<span class="ico dk-back">${icons.back(12)}</span>` : ''}
        <span class="mcf-round">${icons.phone(14)}</span>
        <div>
          <div class="dk-sheet-ttl">New Call Follow-Up</div>
          <div class="dk-sheet-sub">Step ${step} of 2 &#183; ${step === 1 ? 'Configure' : 'Choose parties'}</div>
        </div>
        <span class="ico dk-x">${icons.close(14)}</span>
      </div>

      ${step === 1 ? `
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

      <div class="dk-field-k">LANGUAGE</div>
      <div class="dk-chiprow">
        ${LANGUAGES.map(l => `
          <span class="dk-chip2 ${l.label === language ? 'on' : ''}" ${l.id ? `id="${l.id}"` : ''}>${esc(l.label)}</span>`).join('')}
      </div>

      <div class="dk-field-k">TONE</div>
      <div class="dk-chiprow">
        ${TONES.map(t => `
          <span class="dk-chip2 ${t.label === tone ? 'on' : ''} ${t.label === 'Legal Action' ? 'legal' : ''}" id="${t.id}">${esc(t.label)}</span>`).join('')}
      </div>

      <div class="dk-go" id="continue">Continue &#183; Select parties</div>` : `
      <!-- What was configured, kept in view while the parties are chosen: the
           owner is deciding who gets rung, and needs to see what they are
           being signed up for. -->
      <div class="dk-conf">
        <div class="dk-conf-k">CONFIGURED AUTOMATION<span class="dk-conf-edit">Edit</span></div>
        <div class="dk-conf-chips">
          <span class="dk-conf-chip"><span class="ico">${icons.phone(9)}</span>Call Follow-Up</span>
          <span class="dk-conf-chip">Friendly &#183; Alternate days</span>
          <span class="dk-conf-chip">Overdue 3m&#8211;6m</span>
        </div>
      </div>

      <div class="dk-pickbar">
        <span class="dk-pickall" id="select-all">Select all</span>
        <span class="dk-picksearch"><span class="ico">${icons.search(10)}</span>Search parties...</span>
      </div>

      <div class="dk-picks">
        ${rows.slice(0, 4).map((p, i) => `
          <div class="dk-pick ${all || i === 0 ? 'on' : ''}" ${i < 2 ? `id="party-pick-${i}"` : ''}>
            <span class="dk-tick">${all || i === 0 ? icons.check(10) : ''}</span>
            <div>
              <div class="dk-pick-nm">${esc(p.name)}</div>
              <div class="dk-pick-s">${short(p.balance)}${p.overdueDays > 0 ? ' &#183; <b>' + p.overdueDays + 'd overdue</b>' : ''}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="dk-go" id="activate">Activate Automation</div>`}
    </div>` : ''}
</div>`;
}
