import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger } from './mcf-data.js';

export const name = 'mcf-ai-ringing';

/* The call as the party receives it: their own phone, ringing, with myCashFlo
 * on the other end.
 *
 * The AI call screen shows the owner's side. This shows the other side, which
 * is what "the AI is calling the person" actually looks like - and it is the
 * shot that makes the point without a word of voiceover, because the phone
 * ringing in somebody else's hand is the whole product.
 *
 * It names the business, not the AI alone: a party who cannot tell who is
 * ringing does not answer, and an ad that hid that would be selling something
 * worse than the real thing.
 *
 * NO REFERENCE FRAME - drawn from what the product does. Check before
 * publishing. Coordinates MEASURED.
 */
export const targets = {
  'accept': { x: 278, y: 747 },
  'decline': { x: 111, y: 747 }
};

/* Rings twice a second, from the shot's own clock, so two renders match. */
export function ringPulse(t) {
  return Math.abs(Math.sin((Number(t) || 0) * Math.PI));
}

export function render(data, state) {
  const book = ledger(data);
  const party = book.parties[0];
  const business = data?.business?.name || 'Your Business';
  const t = Number(state?.t ?? 0);

  const pulse = ringPulse(t);
  /* The ring spreads and fades rather than blinking, which on video reads as
     a phone ringing rather than as something broken. */
  const halo = (1 + pulse * 0.22).toFixed(3);
  const fade = (0.45 - pulse * 0.35).toFixed(3);

  return `
<div class="screen mcfscreen ringscreen">
  <div class="mcf-ring-top">
    <div class="mcf-ring-label">Incoming call</div>

    <div class="mcf-ring-avatar">
      <span class="mcf-halo" style="transform: scale(${halo}); opacity: ${fade}"></span>
      <span class="mcf-ring-mark">${icons.phone(26)}</span>
    </div>

    <div class="mcf-ring-who">myCashFlo AI</div>
    <div class="mcf-ring-for">calling on behalf of ${esc(business)}</div>
    <div class="mcf-ring-badge">
      <span class="ico">${icons.check(12)}</span>Verified business call
    </div>
  </div>

  <div class="mcf-ring-to">to ${esc(party.name)}</div>

  <div class="mcf-ring-actions">
    <div class="mcf-ringbtn decline" id="decline">
      <span class="mcf-ringring end">${icons.phoneOff(20)}</span>Decline
    </div>
    <div class="mcf-ringbtn accept" id="accept">
      <span class="mcf-ringring go">${icons.phone(20)}</span>Accept
    </div>
  </div>
</div>`;
}
