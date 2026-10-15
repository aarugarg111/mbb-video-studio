import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger } from './mcf-data.js';

export const name = 'mcf-new-automation';

/* Setting up an automation - and the moment the owner picks the AI to do the
 * chasing instead of doing it himself. That choice is the product's whole
 * pitch, and until now the clip could show the AI calling but never the
 * decision to let it.
 *
 * "New Automation" on the automations list has always been tappable and led
 * nowhere; this is the screen behind it.
 *
 * NO REFERENCE FRAME. Like mcf-tally and mcf-ai-call, this is drawn in
 * myCashFlo's own language from what the product does, not rebuilt from a
 * recording. Check it against the real app before publishing.
 *
 * Coordinates MEASURED.
 */
export const targets = {
  'channel-ai': { x: 195, y: 139 },
  'channel-whatsapp': { x: 195, y: 217 },
  'channel-sms': { x: 195, y: 295 },
  'lang-hindi': { x: 58, y: 410 },
  'lang-english': { x: 124, y: 410 },
  'lang-hinglish': { x: 198, y: 410 },
  'tone-friendly': { x: 66, y: 511 },
  'tone-assertive': { x: 146, y: 511 },
  'tone-final': { x: 237, y: 511 },
  'tone-legal': { x: 77, y: 547 },
  'turn-on': { x: 195, y: 802 }
};

/* Which way the chasing happens is the one choice that matters here, so it is
 * the one a clip can be seen making. */
export const tapEffects = {
  'channel-ai': { channel: 'ai' },
  'channel-whatsapp': { channel: 'whatsapp' },
  'channel-sms': { channel: 'sms' },
  /* Which language the AI speaks, and how hard it pushes. A script that says
   * "Tamil mein baat karega" or "legal notice bhejo" was asking for something
   * the screen could not be seen choosing - it had one tappable tone and no
   * language at all - so the clip showed the owner setting up an automation
   * that was not the one the voiceover described. */
  'lang-hindi': { language: 'Hindi' },
  'lang-english': { language: 'English' },
  'lang-hinglish': { language: 'Hinglish' },
  'tone-friendly': { tone: 'Friendly' },
  'tone-assertive': { tone: 'Assertive' },
  'tone-final': { tone: 'Final Notice' },
  'tone-legal': { tone: 'Legal Action' },
  'turn-on': { on: 1 }
};

const CHANNELS = [
  {
    id: 'ai',
    icon: 'phone',
    title: 'AI Call',
    blurb: 'Our AI rings the party, asks when the payment will come, and writes down what they say.',
    recommended: true
  },
  { id: 'whatsapp', icon: 'whatsapp', title: 'WhatsApp', blurb: 'A reminder message with the bill attached.' },
  { id: 'sms', icon: 'send', title: 'SMS', blurb: 'A short reminder, for numbers not on WhatsApp.' }
];

/* DISCLOSED: the language list is not verified against the real app. These are
 * the languages a collections call in this market is actually made in; if
 * myCashFlo offers a different set, correct this list. */
const LANGUAGES = [
  { id: 'lang-hindi', label: 'Hindi' },
  { id: 'lang-english', label: 'English' },
  { id: 'lang-hinglish', label: 'Hinglish' },
  { id: null, label: 'Tamil' },
  { id: null, label: 'Marathi' },
  { id: null, label: 'Gujarati' }
];

/* "Legal Action" is the last step a collections flow has, and it is the one a
 * script reaches for when it wants to sound like the end of patience. It was
 * missing, and "Firm" is now called what the scripts call it. */
const TONES = [
  { id: 'tone-friendly', label: 'Friendly' },
  { id: 'tone-assertive', label: 'Assertive' },
  { id: 'tone-final', label: 'Final Notice' },
  { id: 'tone-legal', label: 'Legal Action' }
];
const WHEN = ['Daily', 'Alternate days', 'Weekly'];

export function render(data, state) {
  const book = ledger(data);
  /* The AI leads because it is what the product is for, and because a clip
   * that has to tap it first would waste a second saying so. */
  const channel = state?.channel ?? 'ai';
  const tone = state?.tone ?? 'Friendly';
  const language = state?.language ?? 'Hindi';
  const on = Number(state?.on ?? 0) > 0;
  const chasing = book.parties.filter(p => p.overdueDays > 0).length;

  const option = c => `
    <div class="mcf-opt ${channel === c.id ? 'on' : ''}" id="channel-${c.id}">
      <span class="mcf-round ${c.id === 'ai' ? '' : 'whatsapp'}">${icons[c.icon](16)}</span>
      <div class="mcf-opt-txt">
        <div class="mcf-opt-ttl">
          ${esc(c.title)}
          ${c.recommended ? '<span class="mcf-rec">Recommended</span>' : ''}
        </div>
        <div class="mcf-opt-sub">${esc(c.blurb)}</div>
      </div>
      <span class="mcf-tick">${channel === c.id ? icons.check(14) : ''}</span>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar">
    <span class="ico">${icons.back(20)}</span>
    <div class="mcf-biz">New Automation</div>
  </div>

  <div class="mcf-body">
    <div class="mcf-card">
      <div class="mcf-label">HOW SHOULD WE FOLLOW UP?</div>
      <div class="mcf-opts">${CHANNELS.map(option).join('')}</div>
    </div>

    <div class="mcf-card">
      <div class="mcf-label">LANGUAGE</div>
      <div class="mcf-chiprow">
        ${LANGUAGES.map(l => `
          <div class="mcf-pick ${l.label === language ? 'on' : ''}" ${l.id ? `id="${l.id}"` : ''}>${esc(l.label)}</div>`).join('')}
      </div>

      <div class="mcf-label spaced">TONE</div>
      <div class="mcf-chiprow">
        ${TONES.map(t => `
          <div class="mcf-pick ${t.label === tone ? 'on' : ''} ${t.label === 'Legal Action' ? 'legal' : ''}" id="${t.id}">${esc(t.label)}</div>`).join('')}
      </div>

      ${tone === 'Legal Action' ? `
        <div class="mcf-legal-note">
          <span class="ico">${icons.legal(13)}</span>A legal notice is drafted and sent by registered post. The party is told before the call.
        </div>` : ''}

      <div class="mcf-label spaced">HOW OFTEN</div>
      <div class="mcf-chiprow">
        ${WHEN.map((w, i) => `<div class="mcf-pick ${i === 0 ? 'on' : ''}">${esc(w)}</div>`).join('')}
      </div>
    </div>

    <div class="mcf-card row">
      <div class="mcf-pausetxt">
        <div class="mcf-pause-ttl">Overdue 1 day to 1 month</div>
        <div class="mcf-pause-sub">${chasing} ${chasing === 1 ? 'party' : 'parties'} to chase</div>
      </div>
      <span class="ico mcf-chev">${icons.chevDown(14)}</span>
    </div>

    ${on ? `
      <div class="mcf-live-note">
        <span class="ico">${icons.check(14)}</span>Automation on &#183; ${chasing} ${chasing === 1 ? 'party' : 'parties'}
      </div>` : ''}
  </div>

  <div class="mcf-foot">
    <div class="mcf-btn wide" id="turn-on">${on ? 'Automation is on' : 'Turn on Automation'}</div>
  </div>
</div>`;
}
