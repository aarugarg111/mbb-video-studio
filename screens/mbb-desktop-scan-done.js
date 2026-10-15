import { icons } from '../src/icons.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-scan-done';

/* The moment the bill has been read, on a laptop.
 *
 * The claim underneath - that this saved about five minutes of typing - is the
 * app's own and is the whole point of the feature, so it is worded exactly as
 * the phone screen words it. A clip that shows the scan without it has shown a
 * loading spinner and nothing else.
 *
 * DISCLOSED: no reference frame. See mbb-desktop-scan.js.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/scan-and-record';

export const focus = { x: 360, y: 203, scale: 1 };

/* Nothing is tapped on the confirmation; it passes on its own - same as the
 * phone. The bill it made is opened by cutting to the invoice screen. */
export const targets = {};

export function render(data, state) {
  const t = Math.max(0, Number(state?.t ?? 0));
  /* Springs in rather than appearing, the way the phone's does. */
  const pop = Math.min(1, t / 0.45);
  const scale = (0.6 + 0.4 * (1 - Math.pow(1 - pop, 3))).toFixed(3);
  const seconds = Number(state?.seconds ?? 10.3).toFixed(1);
  const fade = (from, over) => Math.min(1, Math.max(0, (t - from) / over)).toFixed(3);

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Purchases', 'Scan & Record')}

  <div class="mb-main">
    <div class="mb-top"><div class="mb-title">Scan &amp; Record Bills</div></div>
  </div>

  <div class="mb-scrim"></div>
  <div class="dsc-done">
    <div class="dsc-done-tick" id="tick" style="transform: scale(${scale})">${icons.check(30)}</div>
    <div class="dsc-done-k" style="opacity: ${fade(0.3, 0.4)}">Scanned in ${seconds}s!</div>
    <div class="dsc-done-s" style="opacity: ${fade(0.6, 0.4)}">We saved you ~5mins of typing</div>
  </div>
</div>`;
}
