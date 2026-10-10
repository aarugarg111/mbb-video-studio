import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { ledger, short, rupeesExact } from './mcf-data.js';
import { MCF_NAV, walletPill, supportPill } from './mcf-chrome.js';

export const name = 'mcf-tally';

/* myCashFlo's side of the Tally connection: the outstanding it pulled across,
 * and when it last looked.
 *
 * This is NOT Tally. The studio renders app interfaces, and Tally is somebody
 * else's - a shot of the owner looking at Tally on a laptop is footage the
 * creator films. What belongs here is what myCashFlo shows about the sync,
 * which is the half the ad is actually selling.
 *
 * The "Syncing..." row is from reference/frames/mcf-7.png, where the dashboard
 * carries exactly that line and spinner. The rest of this screen has no
 * reference frame behind it - see the note in the report.
 */
export const targets = {
  'sync-now': { x: 195, y: 86 },
  'tally-status': { x: 195, y: 212 },
  'nav-dashboard': { x: 38, y: 810 },
  'nav-parties': { x: 113, y: 810 }
};

/* A sync that is still running when the shot opens and done by the end of it,
 * so the clip shows the thing happening rather than a static "Synced" badge.
 * Pure in t, like everything else, so renders stay reproducible. */
export const SYNC_SECONDS = 2.2;

export function syncProgress(t) {
  const elapsed = Number(t) || 0;
  return Math.max(0, Math.min(1, elapsed / SYNC_SECONDS));
}

export function render(data, state) {
  const book = ledger(data);
  const progress = syncProgress(state?.t);
  const done = progress >= 1;
  /* Counts up with the bar, so the number on screen and the bar agree. */
  const pulled = Math.round(book.parties.length * progress);

  const line = (label, value, strong = false) => `
    <div class="mcf-tline">
      <span class="mcf-tlabel">${esc(label)}</span>
      <span class="mcf-tvalue ${strong ? 'strong' : ''}">${esc(value)}</span>
    </div>`;

  return `
<div class="screen mcfscreen">
  <div class="mcf-bar plain">
    <div class="mcf-title">Tally</div>
    ${walletPill(book.wallet, rupeesExact)}
  </div>

  <div class="mcf-body">
    <div class="mcf-btn wide" id="sync-now">
      <span class="ico">${icons.sync(15)}</span>${done ? 'Synced' : 'Syncing…'}
    </div>

    <div class="mcf-card" id="tally-status">
      <div class="mcf-trow">
        <span class="mcf-round ${done ? 'ok' : ''}">${icons.ledger(16)}</span>
        <div class="mcf-pausetxt">
          <div class="mcf-pause-ttl">Tally Prime</div>
          <div class="mcf-pause-sub">${done ? 'Up to date' : 'Reading outstanding…'}</div>
        </div>
        <span class="mcf-dot ${done ? '' : 'waiting'}"></span>
      </div>

      <div class="mcf-bar-track"><span style="width: ${(progress * 100).toFixed(1)}%"></span></div>

      ${line('Parties', String(pulled))}
      ${line('Outstanding', short(Math.round(book.outstanding * progress)), true)}
      ${line('Overdue', short(Math.round(book.overdue * progress)))}
    </div>

    <div class="mcf-card short">
      <div class="mcf-label">WHAT HAPPENS NEXT</div>
      <div class="mcf-quiet">${done
        ? 'Every overdue party is now in the follow-up list.'
        : 'Parties are being matched to their bills.'}</div>
    </div>
  </div>

  ${supportPill()}
  ${MCF_NAV('dashboard')}
</div>`;
}
