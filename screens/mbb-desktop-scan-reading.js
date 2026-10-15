import { icons } from '../src/icons.js';
import { sidebar } from './mbb-desktop-chrome.js';
import { TIPS } from './scan-reading.js';

export const name = 'mbb-desktop-scan-reading';

/* The wait while the bill is read, on a laptop. The phone gives this its own
 * full screen; a laptop keeps the page it was on and reads the bill in a
 * window over it, which is what the app does everywhere else on a desktop.
 *
 * The counter and the tips are the phone screen's, imported rather than
 * rewritten: the same wait, worded the same way, so a viewer who has seen the
 * phone ad recognises this one. It is derived from the shot clock rather than
 * stored, so the screen stays a pure function of time and two renders of one
 * recipe are the same file.
 *
 * DISCLOSED: no reference frame. See mbb-desktop-scan.js.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/scan-and-record';

export const focus = { x: 360, y: 203, scale: 1 };

/* Nothing is tapped while the bill is being read - same as the phone. */
export const targets = {};

export function render(data, state) {
  const t = Math.max(0, Number(state?.t ?? 0));
  const shown = (t + 1).toFixed(1);
  const tip = Math.min(TIPS.length - 1, Math.floor(t / 2.2));

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Purchases', 'Scan & Record')}

  <div class="mb-main">
    <div class="mb-top"><div class="mb-title">Scan &amp; Record Bills</div></div>
  </div>

  <div class="mb-scrim"></div>
  <div class="dsc-read">
    <div class="dsc-read-glass">${icons.search(26)}</div>
    <div class="dsc-read-k">Reading your bill...</div>
    <div class="dsc-read-secs">${shown}s</div>

    <div class="dsc-read-tip">
      <div class="dsc-read-tip-k"><span class="ico">${icons.info(11)}</span>Quick Tips</div>
      <div class="dsc-read-tip-t">${TIPS[tip]}</div>
      <div class="dsc-read-dots">${TIPS.map((_, i) => `<i class="${i === tip ? 'on' : ''}"></i>`).join('')}</div>
    </div>

    <div class="dsc-read-by">Powered by Mira AI</div>
    <div class="dsc-read-warn">
      <span class="ico">${icons.info(11)}</span>
      Please check the details wisely before proceeding, as AI can make mistakes.
    </div>
  </div>
</div>`;
}
