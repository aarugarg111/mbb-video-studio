import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, attentionCards, short, rupeesExact } from './mcf-data.js';
import { MCF_NAV, walletPill, supportPill } from './mcf-chrome.js';

export const name = 'mcf-dashboard';

/* myCashFlo's dashboard (reference/frames/mcf-7.png): what is owed, how much
 * of it is late, and who to chase first. Coordinates are in 390x844 space and
 * are MEASURED from a render, never estimated - earlier guesses on other
 * screens were out by as much as 230px. Re-measure if the layout changes. */
export const targets = {
  'call-personally': { x: 157, y: 408 },
  'outstanding': { x: 195, y: 140 },
  'nav-parties': { x: 113, y: 810 },
  'nav-automations': { x: 277, y: 810 }
};

export function render(data, state) {
  const book = ledger(data);
  const cards = attentionCards(book);
  const business = data?.business?.name || 'Your Business';

  const flag = p => `
    <div class="mcf-flag">
      <div class="mcf-flag-top">
        <span class="mcf-flag-nm">${esc(p.name)}</span>
        <span class="mcf-flag-amt">${short(p.balance)}</span>
      </div>
      <div class="mcf-flag-why">${esc(p.reason)}</div>
    </div>`;

  /* Both cards are built the same way, because in the app they are the same
     card - the second is simply cut off by the screen edge, and that overhang
     is what tells you the strip scrolls. A stub drawn specially would read as
     a rendering fault rather than as more parties. */
  const attentionCard = (group, i) => `
    <div class="mcf-attn-card">
      ${group.parties.map(flag).join('')}
      ${group.more > 0 ? `<div class="mcf-more">+${group.more} more</div>` : ''}
      <div class="mcf-btn" ${i === 0 ? 'id="call-personally"' : ''}>Call Personally</div>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar">
    <span class="ico">${icons.back(20)}</span>
    <div class="mcf-biz">${esc(business)}</div>
    ${walletPill(book.wallet, rupeesExact)}
  </div>

  <div class="mcf-body">
    <div class="mcf-card" id="outstanding">
      <div class="mcf-label">TOTAL OUTSTANDING</div>
      <div class="mcf-big">${short(book.outstanding)}</div>
      <div class="mcf-rule"></div>
      <div class="mcf-split">
        <div>
          <div class="mcf-sub overdue"><span class="ico">${icons.warning(14)}</span>OVERDUE</div>
          <div class="mcf-sub-amt">${short(book.overdue)}</div>
        </div>
        <div>
          <div class="mcf-sub soon"><span class="ico">${icons.clock(14)}</span>DUE SOON</div>
          <div class="mcf-sub-amt">${short(book.dueSoon)}</div>
        </div>
      </div>
    </div>

    <div class="mcf-card">
      <div class="mcf-label">PARTIES THAT NEED ATTENTION</div>
      <div class="mcf-attn">${cards.map(attentionCard).join('')}</div>
    </div>

    <div class="mcf-card short">
      <div class="mcf-label">FOLLOW-UPS DONE</div>
    </div>
  </div>

  ${supportPill()}
  ${MCF_NAV('dashboard')}
</div>`;
}
