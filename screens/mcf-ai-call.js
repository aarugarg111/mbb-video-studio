import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short } from './mcf-data.js';

export const name = 'mcf-ai-call';

/* The AI making the follow-up call, with what is said appearing as it is said.
 *
 * This is the beat the product is sold on - the owner does not ring anybody.
 * The automations list in reference/frames/mcf-19.png shows the calls being
 * scheduled; this is one of them happening. There is no reference frame for
 * this screen, so it is drawn in myCashFlo's own language from the script -
 * see the note in the report.
 *
 * Coordinates MEASURED.
 */
export const targets = {
  'end-call': { x: 195, y: 790 },
  'listen': { x: 325, y: 790 },
  'mute': { x: 65, y: 790 }
};

/* The call, as a timetable. Each line appears when the clock reaches it, so
 * the transcript writes itself across the shot instead of arriving whole -
 * and because it is a pure function of t, two renders are identical.
 *
 * The customer is invented. The words are the script's own. */
export const TRANSCRIPT = [
  { at: 0.8, who: 'ai', text: 'Sir, payment kab tak clear ho jayega?' },
  { at: 3.2, who: 'them', text: 'Kal afternoon tak kar deta hoon.' },
  { at: 5.4, who: 'ai', text: 'Theek hai sir, kal afternoon ka commitment note kar liya.' }
];

/* Shown once the last line has landed: the point of the call. */
export const COMMITMENT_AT = 7.4;

export function spokenBy(t) {
  const elapsed = Number(t) || 0;
  return TRANSCRIPT.filter(line => elapsed >= line.at);
}

/* mm:ss from the shot's own clock, so the timer on screen matches the length
 * of the shot rather than counting from some arbitrary number. */
export function callTimer(t) {
  const total = Math.max(0, Math.floor(Number(t) || 0));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function render(data, state) {
  const book = ledger(data);
  const party = book.parties[0];
  const t = Number(state?.t ?? 0);
  /* Set by mcf-ai-noanswer in an earlier shot, which persists it: this is the
   * same call screen, dialling the OTHER number the party has on file. */
  const alternate = state?.outcome === 'alternate';
  const said = spokenBy(t);
  const committed = t >= COMMITMENT_AT;

  /* Four bars, each on its own cycle, so the waveform moves while the AI is
   * speaking and settles while it listens. */
  const speaking = said.length > 0 && said[said.length - 1].who === 'ai';
  const bars = [0, 1, 2, 3, 4].map(i => {
    const h = speaking
      ? 22 + 18 * Math.abs(Math.sin(t * 4 + i * 0.9))
      : 10 + 3 * Math.abs(Math.sin(t * 1.5 + i));
    return `<span style="height: ${h.toFixed(1)}px"></span>`;
  }).join('');

  const bubble = line => `
    <div class="mcf-said ${line.who}">
      <div class="mcf-said-who">${line.who === 'ai' ? 'myCashFlo AI' : esc(party.name)}</div>
      <div class="mcf-said-text">${esc(line.text)}</div>
    </div>`;

  const action = (id, label, icon, kind = '') => `
    <div class="mcf-callbtn ${kind}" id="${id}">
      <span class="mcf-callring">${icons[icon](18)}</span>${label}
    </div>`;

  return `
<div class="screen mcfscreen callscreen">
  <div class="mcf-callhead">
    <div class="mcf-calllabel">
      <span class="mcf-live"></span>${alternate ? 'Calling alternate number' : 'AI is calling'}
    </div>
    <div class="mcf-callname">${esc(party.name)}</div>
    <div class="mcf-callowed">
      ${short(party.balance)} &#183; ${party.overdueDays}d overdue
      ${alternate ? '<span class="mcf-altnum">&#183; alternate number</span>' : ''}
    </div>
    <div class="mcf-wave">${bars}</div>
    <div class="mcf-calltime">${callTimer(t)}</div>
  </div>

  <div class="mcf-transcript">
    ${said.map(bubble).join('')}
    ${committed ? `
      <div class="mcf-commit">
        <span class="ico">${icons.check(14)}</span>Commitment noted &#183; tomorrow afternoon
      </div>` : ''}
  </div>

  <div class="mcf-callbar">
    ${action('mute', 'Mute', 'mic')}
    ${action('end-call', 'End', 'phoneOff', 'end')}
    ${action('listen', 'Listen', 'whatsapp')}
  </div>
</div>`;
}
