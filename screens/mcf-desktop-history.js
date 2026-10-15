import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short } from './mcf-data.js';
import { hostRail, mcfRail, topBar } from './mcf-desktop-chrome.js';
import { ATTEMPTS } from './mcf-attempts.js';

export const name = 'mcf-desktop-history';

/* The follow-up history on a laptop - "History" in myCashFlo's own nav, which
 * has been in the rail since the first laptop page and led nowhere.
 *
 * Same attempts as the phone's mcf-attempts, imported rather than copied, so
 * one party cannot have been chased two different ways depending on which
 * shape the reel was cut in. The laptop shows them as a table with the party
 * beside each attempt, because a desk is where you look at all of them at
 * once; the phone shows one party's worth as a timeline.
 *
 * DISCLOSED: no reference frame. See screens/mcf-attempts.js.
 */
export const device = 'desktop';
export const url = 'mycashflo.ai/history';

export const focus = { x: 410, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'attempt-0': { x: 461, y: 119 },
  'attempt-3': { x: 461, y: 197 },
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
  const party = book.parties[0];

  const row = (a, i) => `
    <div class="dkh-row ${a.kind}" ${i === 0 || i === 3 ? `id="attempt-${i}"` : ''}>
      <div class="dkh-c when">${esc(a.when)}</div>
      <div class="dkh-c who">${esc(party.name)}</div>
      <div class="dkh-c how">
        <span class="ico">${icons[a.via === 'phone' ? 'phone' : 'whatsapp'](10)}</span>${esc(a.how)}
      </div>
      <div class="dkh-c out"><span class="dkh-pill">${esc(a.outcome)}</span></div>
      <div class="dkh-c note">${esc(a.note)}</div>
    </div>`;

  return `
<div class="screen dkscreen">
  ${hostRail(data?.business?.name)}
  ${mcfRail('History', book.wallet)}

  <div class="dk-main">
    ${topBar('History', null, asking)}

    <div class="dkh-body">
      <div class="dkh-head">
        <div class="dkh-k">FOLLOW-UPS, MOST RECENT LAST</div>
        <!-- The sentence the whole page exists to let somebody say out loud. -->
        <div class="dkh-sum">${ATTEMPTS.length} attempts on ${esc(party.name)} &#183; ${short(party.balance)}</div>
      </div>

      <div class="dkh-table">
        <div class="dkh-row head">
          <div class="dkh-c when">When</div>
          <div class="dkh-c who">Party</div>
          <div class="dkh-c how">How</div>
          <div class="dkh-c out">Outcome</div>
          <div class="dkh-c note">What came of it</div>
        </div>
        ${ATTEMPTS.map(row).join('')}
      </div>

      <div class="dkh-done">
        <span class="ico">${icons.check(11)}</span>Chasing stopped on its own once the commitment was recorded
      </div>
    </div>
  </div>
</div>`;
}
