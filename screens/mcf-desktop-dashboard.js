import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short } from './mcf-data.js';
import { hostRail, mcfRail, topBar } from './mcf-desktop-chrome.js';

export const name = 'mcf-desktop-dashboard';

/* myCashFlo's dashboard on a laptop (reference/frames/dmcf-86.png).
 *
 * The phone has mcf-dashboard and the laptop had nothing, so a collections clip
 * cut in the laptop shape had to start half way through its own story - on the
 * parties table, with no answer to "how much is stuck" before it.
 *
 * The page is built round one idea: PARTIES THAT NEED ATTENTION, grouped by
 * what is WRONG with them rather than by how much they owe, each group with the
 * one button that fixes it. Disputing an amount needs a person to ring them;
 * no automation needs a follow-up setting up; no contact number needs a number.
 * That is the argument the product makes, so it is what the screen shows.
 *
 * Every figure is worked out from the same ledger the phone's dashboard reads,
 * so the two shapes cannot show one business two different outstandings.
 */
export const device = 'desktop';
export const url = 'mycashflo.ai/dashboard';

/* Two rails to clear before the content starts, as on every myCashFlo page. */
export const focus = { x: 410, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'call-personally': { x: 308, y: 111 },
  'setup-followups': { x: 433, y: 192 },
  'add-contact': { x: 371, y: 275 },
  'outstanding': { x: 597, y: 114 },
  'nav-parties': { x: 164, y: 77 },
  'nav-automations': { x: 164, y: 129 },
  'ask-ai': { x: 585, y: 28 }
};

export const tapEffects = {
  'ask-ai': { asking: 1 }
};

export function render(data, state) {
  const book = ledger(data);
  const asking = Number(state?.asking ?? 0) > 0;
  const parties = book.parties;

  /* The three groups the app splits the book into. Which party lands in which
   * is derived, not assigned: the longest overdue are the ones disputing, the
   * ones with nothing running need an automation, and the tail has no number
   * on file. A real book looks like this - the trouble is not spread evenly. */
  const disputing = parties.filter(p => p.overdueDays > 180).slice(0, 2);
  const noAuto = parties.filter(p => p.overdueDays > 0 && p.overdueDays <= 180).slice(0, 2);
  const noContact = parties.filter(p => p.overdueDays === 0).slice(0, 2);
  const rest = Math.max(0, parties.length - disputing.length - noAuto.length - noContact.length);

  const overdue = parties.filter(p => p.overdueDays > 0).reduce((t, p) => t + p.balance, 0);
  const dueSoon = Math.max(0, book.outstanding - overdue);

  const line = (p, tag) => `
    <div class="dkd-line">
      <div>
        <div class="dkd-nm">${esc(p.name)}</div>
        <span class="dkd-tag">${esc(tag)}</span>
      </div>
      <div class="dkd-amt">${short(p.balance)}</div>
    </div>`;

  const card = (rows, tag, more, cta, id) => `
    <div class="dkd-card">
      ${rows.map(p => line(p, tag)).join('')}
      ${more > 0 ? `<div class="dkd-more">+${more} more parties &#8594;</div>` : ''}
      <div class="dkd-cta" id="${id}">${esc(cta)}</div>
    </div>`;

  return `
<div class="screen dkscreen">
  ${hostRail(data?.business?.name)}
  ${mcfRail('Dashboard', book.wallet)}

  <div class="dk-main">
    ${topBar('Dashboard', null, asking)}

    <div class="dkd-body">
      <div class="dkd-attn">
        <div class="dkd-k">PARTIES THAT NEED ATTENTION</div>
        <div class="dkd-cards">
          ${card(disputing, 'Disputing Amount', 0, 'Call Personally', 'call-personally')}
          ${card(noAuto, 'No Automation', rest, 'Setup Follow-ups', 'setup-followups')}
          ${card(noContact, 'No Contact', 0, 'Add Contact Number', 'add-contact')}
        </div>
      </div>

      <div class="dkd-side">
        <div class="dkd-panel" id="outstanding">
          <div class="dkd-k">TOTAL OUTSTANDING</div>
          <div class="dkd-big">${short(book.outstanding)}</div>
          <div class="dkd-split">
            <div>
              <div class="dkd-sk late"><span class="ico">${icons.warning(10)}</span>OVERDUE</div>
              <div class="dkd-sv">${short(overdue)}</div>
            </div>
            <div>
              <div class="dkd-sk soon"><span class="ico">${icons.clock(10)}</span>DUE SOON</div>
              <div class="dkd-sv">${short(dueSoon)}</div>
            </div>
          </div>
        </div>

        <!-- The empty state is the point of the panel, not a gap in it: nothing
             has been followed up because nothing has been set up yet, which is
             what the next tap in the clip goes and fixes. -->
        <div class="dkd-panel">
          <div class="dkd-panel-top">
            <div class="dkd-k">FOLLOW-UPS DONE</div>
            <div class="dkd-toggle"><span class="on">24h</span><span>7d</span></div>
          </div>
          <div class="dkd-empty">
            <span class="ico">${icons.mcfAutomations(18)}</span>
            <div class="dkd-empty-k">No follow-ups yet</div>
            <div class="dkd-empty-s">No follow-ups in the last 24 hours. Set up automation to get started.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;
}
