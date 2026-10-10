import { icons } from '../src/icons.js';

export const name = 'scan-reading';

/* Nothing is tapped while the bill is being read. */
export const targets = {};

/* The wait while the bill is read (reference/frames/scan-t70.png): a magnifier,
 * a counter that climbs, a rotating Quick Tip, and the app's own caution that
 * the reading may be wrong. The counter is derived from the shot clock rather
 * than stored, so the screen stays a pure function of time. */
const TIPS = [
  'Any Party / Item tagged New will be created and added to your inventory',
  'Verify GSTIN, HSN code and GST rates carefully'
];

export function render(data, state) {
  const t = Math.max(0, Number(state?.t ?? 0));
  const shown = (t + 1).toFixed(1);
  const tip = Math.min(TIPS.length - 1, Math.floor(t / 2.2));

  return `
<div class="screen readscreen">
  <div class="readmid">
    <div class="readglass">${icons.search(34)}</div>
    <div class="readlabel">Loading...</div>
    <div class="readsecs">${shown}s</div>
  </div>

  <div class="readtips">
    <div class="readtiphead"><span class="ico">${icons.info(15)}</span>Quick Tips</div>
    <div class="readtiptext">${TIPS[tip]}</div>
    <div class="readdots">${TIPS.map((_, i) => `<i class="${i === tip ? 'on' : ''}"></i>`).join('')}</div>
  </div>

  <div class="readby">Powered by Mira AI</div>

  <div class="readwarn">
    <span class="ico">${icons.info(14)}</span>
    Please check the details wisely before proceeding, as AI can make mistakes.
  </div>
</div>`;
}
