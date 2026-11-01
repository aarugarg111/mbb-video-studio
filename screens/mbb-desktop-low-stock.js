import * as desktopItems from './mbb-desktop-items.js';

export const name = 'mbb-desktop-low-stock';

/* The laptop's Items page with Low Stock already on.
 *
 * The phone has one of these (screens/low-stock.js) because a script that
 * asks what is running out should get the filtered page, not the ordinary
 * stock list with a tap somewhere in it. The same clip filmed on a laptop
 * has to show the same thing, or picking "a laptop" quietly changes what
 * the video is about.
 *
 * Everything but the opening state is the laptop Items page and is NOT
 * copied: same targets, same focus, same measurements. One business cannot
 * be running out of two different things.
 */
export const device = desktopItems.device;
export const url = desktopItems.url;
export const focus = desktopItems.focus;
export const targets = desktopItems.targets;
export const scrolls = desktopItems.scrolls;
export const scrollingTargets = desktopItems.scrollingTargets;

/* Tapping the pill here clears the filter, as its X does in the app - the
 * opposite of what the same button does on the unfiltered page. */
export const tapEffects = { 'low-stock': { lowStock: 0 } };

export function render(data, state) {
  return desktopItems.render(data, { ...state, lowStock: state?.lowStock ?? 1 });
}
