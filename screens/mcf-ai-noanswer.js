import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short } from './mcf-data.js';

export const name = 'mcf-ai-noanswer';

/* The call nobody picked up.
 *
 * Every myCashFlo clip until now showed the call that works: the AI rings, the
 * party answers, a date is agreed. That is the happy path, and a product that
 * only ever shows the happy path is not describing collections. A script that
 * said "phone nahi uthaya" had nothing to cut to.
 *
 * It is a screen rather than a state of mcf-ai-call because a shot cannot be
 * given a starting state - only a tap can change one - so a call that has
 * ALREADY gone unanswered has to be what the screen IS.
 *
 * The beat is the button: the AI has a second number on file and rings that
 * one too. A person would have given up at the first number, and that is the
 * whole argument.
 *
 * DISCLOSED: no reference frame, like mcf-ai-call itself.
 *
 * Coordinates are in 390x844 space and are MEASURED.
 */
export const targets = {
  'try-alternate': { x: 195, y: 264 },
  'end-call': { x: 195, y: 790 }
};

/* Carried into the NEXT shot, so the call screen that follows knows it is
 * dialling the other number and says so. Without this the clip would cut to a
 * call that looked like the first one all over again. */
export const persists = ['outcome'];

export const tapEffects = {
  'try-alternate': { outcome: 'alternate' }
};

export function render(data, state) {
  const book = ledger(data);
  const party = book.parties[0];
  const trying = state?.outcome === 'alternate';

  return `
<div class="screen mcfscreen callscreen">
  <div class="mcf-callhead">
    <div class="mcf-calllabel off">
      <span class="mcf-live"></span>${trying ? 'Calling alternate number' : 'No answer'}
    </div>
    <div class="mcf-callname">${esc(party.name)}</div>
    <div class="mcf-callowed">${short(party.balance)} &#183; ${party.overdueDays}d overdue</div>
  </div>

  <div class="mcf-transcript">
    <div class="mcf-noans">
      <span class="ico">${icons.phoneOff(20)}</span>
      <div class="mcf-noans-k">Rang out after 45 seconds</div>
      <!-- The line that makes this a system rather than a failed phone call. -->
      <div class="mcf-noans-s">Attempt 1 of 3 &#183; another number is on file for this party</div>
      <div class="mcf-noans-go ${trying ? 'on' : ''}" id="try-alternate">
        ${trying ? 'Dialling&#8230;' : 'Try alternate number'}
      </div>
    </div>
  </div>

  <div class="mcf-callbar">
    <div class="mcf-callbtn end" id="end-call">
      <span class="mcf-callring">${icons.phoneOff(18)}</span>Stop
    </div>
  </div>
</div>`;
}
