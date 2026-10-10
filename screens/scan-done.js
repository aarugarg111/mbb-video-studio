import { icons } from '../src/icons.js';

export const name = 'scan-done';

/* Nothing is tapped on the confirmation; it passes on its own. */
export const targets = {};

/* The moment the bill has been read (reference/frames/scan-t78.png). The claim
 * underneath is the app's own and is the point of the feature, so a video that
 * shows the scan without it misses what the scan was for. */
export function render(data, state) {
  const t = Math.max(0, Number(state?.t ?? 0));
  /* Springs in rather than appearing, which is what the app does. */
  const pop = Math.min(1, t / 0.45);
  const scale = (0.6 + 0.4 * (1 - Math.pow(1 - pop, 3))).toFixed(3);
  const seconds = Number(state?.seconds ?? 10.3).toFixed(1);

  return `
<div class="screen donescreen">
  <div class="donemid">
    <div class="donetick" id="tick" style="transform: scale(${scale})">${icons.check(40)}</div>
    <div class="donehead" style="opacity: ${Math.min(1, Math.max(0, (t - 0.3) / 0.4)).toFixed(3)}">Scanned in ${seconds}s!</div>
    <div class="donesub" style="opacity: ${Math.min(1, Math.max(0, (t - 0.6) / 0.4)).toFixed(3)}">We saved you ~5mins of typing</div>
  </div>
</div>`;
}
