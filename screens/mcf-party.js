import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short, phoneOf } from './mcf-data.js';

export const name = 'mcf-party';

/* One party's page (reference/frames/mcf-13.png): what they owe, how to reach
 * them, and what has already been tried. Coordinates are MEASURED. */
export const targets = {
  'call': { x: 72, y: 85 },
  'legal': { x: 195, y: 85 },
  'share': { x: 318, y: 85 },
  'pause-calls': { x: 336, y: 461 },
  'add-automation': { x: 343, y: 535 },
  'tab-whatsapp': { x: 154, y: 341 }
};

/* Tapping the toggle pauses the calls - the beat a collections script is
 * usually after, since it is the moment the owner stops chasing by hand. */
export const tapEffects = {
  'pause-calls': { paused: 1 }
};

const TABS = ['Calls', 'WhatsApp', 'Conversations', 'Recordings'];

export function render(data, state) {
  const book = ledger(data);
  const party = book.parties[0];
  const paused = Number(state?.paused ?? 0) > 0;

  const chip = (id, label, icon) => `
    <div class="mcf-chip ${id}" id="${id}"><span class="ico">${icons[icon](16)}</span>${label}</div>`;

  const field = (label, value, editable = true) => `
    <div class="mcf-field">
      <div class="mcf-label">${label}</div>
      <div class="mcf-value">${esc(value)}${editable ? `<span class="ico mcf-pencil">${icons.edit(13)}</span>` : ''}</div>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar">
    <span class="ico">${icons.back(20)}</span>
    <div class="mcf-biz">${esc(party.name)}</div>
    <div class="mcf-owed">
      <div class="mcf-owed-amt">${short(party.balance)}</div>
      ${party.overdueDays > 0 ? `<div class="mcf-owed-late">${short(party.balance)} overdue</div>` : ''}
    </div>
  </div>

  <div class="mcf-body">
    <div class="mcf-chips">
      ${chip('call', 'Call', 'phone')}
      ${chip('legal', 'Legal', 'legal')}
      ${chip('share', 'Share', 'ledger')}
    </div>

    <div class="mcf-card">
      <div class="mcf-head">Party Details</div>
      <div class="mcf-grid">
        ${field('NAME', party.name)}
        ${field('PHONE', phoneOf(party))}
        ${field('STATUS', 'No status', false)}
        ${field('CATEGORY', 'Not set', false)}
      </div>
    </div>

    <div class="mcf-card">
      <div class="mcf-head">Follow-up History</div>
      <div class="mcf-tabs">
        ${TABS.map((t, i) => `
          <div class="mcf-tab" ${i === 1 ? 'id="tab-whatsapp"' : ''}>
            <span class="mcf-tab-box"></span>${esc(t)}
          </div>`).join('')}
      </div>
      <div class="mcf-rule wide"></div>
      <div class="mcf-quiet">${paused ? 'Calls paused. WhatsApp reminders continue.' : 'No follow-ups yet.'}</div>
    </div>

    <div class="mcf-card row">
      <span class="mcf-round">${icons.phoneOff(16)}</span>
      <div class="mcf-pausetxt">
        <div class="mcf-pause-ttl">Pause calls till next follow-up</div>
        <div class="mcf-pause-sub">Whatsapp reminders will continue.</div>
      </div>
      <div class="mcf-toggle ${paused ? 'on' : ''}" id="pause-calls"><span></span></div>
    </div>

    <div class="mcf-card row">
      <div class="mcf-label grow">ACTIVE AUTOMATION (${paused ? 1 : 0})</div>
      <span class="mcf-ghost">${icons.pause(14)}</span>
      <span class="mcf-plus" id="add-automation">${icons.plus(16)}</span>
    </div>
  </div>
</div>`;
}
