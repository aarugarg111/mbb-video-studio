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
  'tone-firm': { x: 133, y: 410 },
  'turn-on': { x: 195, y: 802 }
};

/* Which way the chasing happens is the one choice that matters here, so it is
 * the one a clip can be seen making. */
export const tapEffects = {
  'channel-ai': { channel: 'ai' },
  'channel-whatsapp': { channel: 'whatsapp' },
  'channel-sms': { channel: 'sms' },
  'tone-firm': { tone: 'Firm' },
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

const TONES = ['Friendly', 'Firm', 'Final Notice'];
const WHEN = ['Daily', 'Alternate days', 'Weekly'];

export function render(data, state) {
  const book = ledger(data);
  /* The AI leads because it is what the product is for, and because a clip
   * that has to tap it first would waste a second saying so. */
  const channel = state?.channel ?? 'ai';
  const tone = state?.tone ?? 'Friendly';
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
      <div class="mcf-label">TONE</div>
      <div class="mcf-chiprow">
        ${TONES.map(t => `
          <div class="mcf-pick ${t === tone ? 'on' : ''}" ${t === 'Firm' ? 'id="tone-firm"' : ''}>${esc(t)}</div>`).join('')}
      </div>

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
