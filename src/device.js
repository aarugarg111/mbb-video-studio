/* Phone or desktop: which shape a screen is drawn in.
 *
 * Every screen until now was the phone app, so the stage had one frame and
 * one size baked into it. myBillBook and myCashFlo both have a desktop app
 * too, and a script about sitting at a laptop cannot be told with a phone on
 * screen.
 *
 * A screen declares its own shape rather than the recipe choosing, because a
 * screen IS one or the other - the desktop Parties table is not a phone screen
 * at a different size - and a recipe that had to remember would eventually
 * forget.
 *
 * The sizes below are the logical space a screen is authored in. Both are
 * drawn to the same width in the finished frame, so what changes between them
 * is how much fits, not how big the pixels are:
 *
 *   phone    390 x 844  at 1.8  -> 702 x 1519
 *   desktop  720 x 540  at 1.5  -> 1080 x 810
 *
 * The desktop scale is deliberately high. A real 1280-wide window shrunk into
 * a 1080-wide vertical video puts its text at about four pixels, which nobody
 * can read; 720 logical pixels is a window with fewer things in it, drawn
 * large enough to survive a phone screen held at arm's length.
 */

export const DEVICES = {
  phone: { width: 390, height: 844, scale: 1.8 },
  desktop: { width: 720, height: 540, scale: 1.5 }
};

export const DEFAULT_DEVICE = 'phone';

/* What shape this screen is. Anything that does not say is a phone screen,
 * which keeps every screen built before this unchanged. */
export function deviceOf(screen) {
  const named = screen?.device;
  return named && DEVICES[named] ? named : DEFAULT_DEVICE;
}

export function viewportFor(screen) {
  return DEVICES[deviceOf(screen)];
}

/* The address shown in the frame's URL bar. Only a desktop screen has one -
 * it is a browser - and it is the screen's own business what it says. */
export function urlFor(screen) {
  return screen?.url ?? 'mybillbook.in';
}
