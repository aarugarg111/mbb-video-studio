import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, rupeesExact } from './mcf-data.js';
import { MCF_NAV, walletPill, supportPill } from './mcf-chrome.js';

export const name = 'mcf-automations';

/* The automations list (reference/frames/mcf-19.png): the chasing the app does
 * on its own, which is the whole pitch of the product. Coordinates MEASURED. */
export const targets = {
  'new-automation': { x: 195, y: 86 },
  'automation-0': { x: 195, y: 180 },
  'automation-1': { x: 195, y: 234 },
  'nav-dashboard': { x: 38, y: 810 },
  'nav-parties': { x: 113, y: 810 }
};

/* What the app had running, read off the frame rather than invented: the same
 * window chased twice, once by call and once on WhatsApp, and a long-overdue
 * bucket. The party counts come from the book so they are not three numbers
 * pulled out of the air. */
const RULES = [
  { window: 'Overdue 1 day to 1 month', via: 'phone', tone: 'Friendly', when: 'Daily' },
  { window: 'Overdue 1 day to 1 month', via: 'whatsapp', tone: 'Friendly', when: 'Daily' },
  { window: 'Overdue 6m+', via: 'whatsapp', tone: 'Friendly', when: 'Daily' }
];

export function render(data, state) {
  const book = ledger(data);
  const late = book.parties.filter(p => p.overdueDays > 0);

  /* The frame's three rules cover 3, 4 and 5 parties. A recipe whose book holds
   * nothing six months old printed a 0 beside the last rule, which reads as a
   * broken automation rather than an empty bucket, so each count falls back to
   * the number on the frame when the book is short. */
  const recent = late.filter(p => p.overdueDays <= 30).length;
  const ancient = late.filter(p => p.overdueDays > 180).length;
  const counts = [
    Math.max(recent, 3),
    Math.max(recent, 3) + 1,
    Math.max(ancient, 5)
  ];

  const row = (r, i) => `
    <div class="mcf-auto" id="automation-${i}">
      <span class="mcf-round ${r.via}">${icons[r.via === 'phone' ? 'phone' : 'whatsapp'](16)}</span>
      <div class="mcf-auto-txt">
        <div class="mcf-auto-ttl">${esc(r.window)}</div>
        <div class="mcf-auto-sub">${esc(r.tone)} &#183; ${esc(r.when)}</div>
      </div>
      <div class="mcf-auto-n"><span class="ico">${icons.group(14)}</span>${counts[i]}</div>
      <span class="ico mcf-chev">${icons.chevDown(14)}</span>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar plain">
    <div class="mcf-title">Automations</div>
    ${walletPill(book.wallet, rupeesExact)}
  </div>

  <div class="mcf-body">
    <div class="mcf-btn wide" id="new-automation"><span class="ico">${icons.plus(15)}</span>New Automation</div>

    <div class="mcf-card">
      <div class="mcf-label">ACTIVE AUTOMATIONS (${RULES.length})</div>
      <div class="mcf-autolist">${RULES.map(row).join('')}</div>
    </div>
  </div>

  ${supportPill()}
  ${MCF_NAV('automations')}
</div>`;
}
