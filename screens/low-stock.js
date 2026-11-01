import * as items from './items.js';

export const name = 'low-stock';

/* The Items page with Low Stock already on.
 *
 * There was no such screen. The only way to reach the filtered page was to
 * film `items` and tap `low-stock`, which meant two things went wrong when a
 * script simply asked for it:
 *
 *   - the model wrote `screen: items` and often no tap at all, so the clip
 *     showed the ordinary stock list and never the thing the script was about;
 *   - even when it did write the tap, the first second and a half of the shot
 *     was the unfiltered page, because a tap lands when it lands.
 *
 * So "show me what's running out" is a screen now, and it opens already
 * filtered - which is also what happens in the app when the owner taps the
 * Low Stock card on the dashboard rather than the pill on this page.
 *
 * Everything else is the Items page and is NOT copied: same targets, same
 * rows, same promo strip, same measurements. A second copy of that would
 * drift, and the two pages would stop agreeing about where a row is.
 */
export const targets = items.targets;
export const scrolls = items.scrolls;
export const scrollingTargets = items.scrollingTargets;

/* Tapping the pill here clears the filter, which is what the X on it does in
 * the app - the opposite of what it does on the Items page, where the pill is
 * off and the tap turns it on. Same button, same screen, read whichever way
 * round it was opened. */
export const tapEffects = { 'low-stock': { lowStock: 0 } };

export function render(data, state) {
  /* Filtered unless the shot has turned it off. `?? 1` rather than `|| 1`:
   * a shot that tapped the pill sets it to 0, and 0 is a real answer. */
  return items.render(data, { ...state, lowStock: state?.lowStock ?? 1 });
}
