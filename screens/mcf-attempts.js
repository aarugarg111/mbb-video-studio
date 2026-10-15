import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short } from './mcf-data.js';

export const name = 'mcf-attempts';

/* What has actually been tried on one party, in order.
 *
 * A collections clip could show a call being made and an automation being set
 * up, and had nothing to show for "teen baar follow-up kiya" - the thing that
 * makes the product sound like persistence rather than one lucky phone call.
 * The party page had a Calls tab that said "No follow-ups yet" and nothing
 * behind it.
 *
 * The sequence below is the one the product actually runs: ring the number on
 * file, ring the other number when nobody picks up, send a WhatsApp, and ring
 * again the next morning - escalating, and stopping the moment somebody
 * commits to a date. That ordering is the argument, so it is what the screen
 * shows, with the outcome of each attempt rather than just its time.
 *
 * DISCLOSED: no reference frame. The attempts are the ones the automation
 * screens describe; the layout is this app's own list style.
 *
 * Coordinates are in 390x844 space and are MEASURED.
 */
export const targets = {
  'attempt-0': { x: 195, y: 206 },
  'attempt-1': { x: 195, y: 268 },
  'call-again': { x: 287, y: 804 },
  'pause-calls': { x: 103, y: 804 }
};

export const tapEffects = {
  'pause-calls': { paused: 1 }
};

/* Each attempt: when, how, and what came of it. "kind" drives the colour, so
 * a glance down the list reads as three failures and a success rather than as
 * four identical rows. */
export const ATTEMPTS = [
  { when: 'Mon, 9:10 am', how: 'AI call', via: 'phone', outcome: 'No answer', kind: 'miss', note: 'Rang out after 45s' },
  { when: 'Mon, 9:12 am', how: 'AI call', via: 'phone', outcome: 'No answer', kind: 'miss', note: 'Alternate number' },
  { when: 'Mon, 11:00 am', how: 'WhatsApp', via: 'whatsapp', outcome: 'Delivered', kind: 'sent', note: 'Reminder with the bill attached' },
  { when: 'Tue, 10:30 am', how: 'AI call', via: 'phone', outcome: 'Answered', kind: 'won', note: 'Commitment: tomorrow afternoon' }
];

export function render(data, state) {
  const book = ledger(data);
  const party = book.parties[0];
  const paused = Number(state?.paused ?? 0) > 0;
  /* How far down the list the clip has got, so the attempts can arrive one at
   * a time instead of all at once. Derived from the shot clock, which keeps
   * the screen a pure function of t. */
  const shown = Math.max(1, Math.min(ATTEMPTS.length, Math.floor(Number(state?.t ?? 99) / 0.9) + 1));

  const row = (a, i) => `
    <div class="at-row ${a.kind}" ${i < 2 || i === 3 ? `id="attempt-${i}"` : ''}>
      <div class="at-rail"><span class="at-dot"></span>${i < shown - 1 ? '<span class="at-line"></span>' : ''}</div>
      <div class="at-body">
        <div class="at-top">
          <span class="at-how"><span class="ico">${icons[a.via === 'phone' ? 'phone' : 'whatsapp'](12)}</span>${esc(a.how)}</span>
          <span class="at-when">${esc(a.when)}</span>
        </div>
        <div class="at-outcome">${esc(a.outcome)}</div>
        <div class="at-note">${esc(a.note)}</div>
      </div>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar">
    <span class="ico">${icons.back(20)}</span>
    <div class="mcf-biz">Follow-up history</div>
  </div>

  <div class="mcf-body">
    <div class="mcf-card row">
      <div class="mcf-pausetxt">
        <div class="mcf-pause-ttl">${esc(party.name)}</div>
        <div class="mcf-pause-sub">${short(party.balance)} &#183; ${party.overdueDays}d overdue</div>
      </div>
      <span class="at-count">${shown} ${shown === 1 ? 'attempt' : 'attempts'}</span>
    </div>

    <div class="mcf-card">
      <div class="mcf-label">WHAT WE HAVE TRIED</div>
      <div class="at-list">${ATTEMPTS.slice(0, shown).map(row).join('')}</div>
    </div>

    <!-- The point of the list: nobody had to remember to do any of it, and
         it stopped on its own once the party committed to a date. -->
    ${shown >= ATTEMPTS.length ? `
      <div class="at-done">
        <span class="ico">${icons.check(14)}</span>Chasing stopped &#183; commitment recorded
      </div>` : ''}
  </div>

  <div class="mcf-foot two">
    <div class="mcf-btn ghost" id="pause-calls">${paused ? 'Calls paused' : 'Pause calls'}</div>
    <div class="mcf-btn" id="call-again">Call again</div>
  </div>
</div>`;
}
