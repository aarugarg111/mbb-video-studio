import { icons } from '../src/icons.js';
import { esc } from '../src/esc.js';

/* Shared pieces of the three Android / WhatsApp screens: the system bars and
 * a few small helpers. Nothing here is real: the contacts are invented. */

/* U+00B7 is inside the embedded latin subset, so it renders the same everywhere. */
export const FILE_META = '1 page · 152 kB · PDF';

export function statusBar() {
  return `<div class="wa-status"><span class="t">11:59</span><span class="r">${icons.signal(13)}${icons.wifi(14)}${icons.battery(20)}</span></div>`;
}

export function navBar() {
  return `<div class="wa-nav"><span class="ico">${icons.navRecents(20)}</span><span class="ico">${icons.navHome(20)}</span><span class="ico">${icons.navBack(20)}</span></div>`;
}

/* The recipe's party is the chosen contact; a recipe with none still shows a
 * plausible one. Party names are written in capitals on the bill, but a saved
 * contact reads in ordinary case. */
export function contactName(data) {
  const raw = String(data?.party?.name ?? '').trim();
  const name = raw && raw === raw.toUpperCase()
    ? raw.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
    : raw;
  return name || 'Rakesh Kumar';
}

export function initial(name) {
  return esc(String(name || '?').trim().charAt(0).toUpperCase());
}
