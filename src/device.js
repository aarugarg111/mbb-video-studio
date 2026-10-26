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
 *   phone    390 x 844   (at 1.8 in a vertical video -> 702 x 1519)
 *   desktop  720 x 405   (at 1.5 in a vertical video -> 1080 x 608)
 *
 * The desktop scale is deliberately high. A real 1280-wide window shrunk into
 * a 1080-wide vertical video puts its text at about four pixels, which nobody
 * can read; 720 logical pixels is a window with fewer things in it, drawn
 * large enough to survive a phone screen held at arm's length.
 *
 * It is 16:9 because the app's own window is - reference/frames/dmbb-7.png is
 * 1900 x 1080. It was 4:3 for a while, a third taller for its width, and every
 * laptop screen drawn in it came out stretched down the page: rows too deep,
 * cards too tall, the whole thing looking like the app with something wrong
 * with it. Nobody could say what, and everybody could see it.
 *
 * How big each is DRAWN, and how far the camera rests into a laptop window
 * before a shot asks for anything, are NOT here. Those belong to the shape of
 * the finished video - a 16:9 window needs a shove to fill a Reel and none at
 * all to fill a widescreen, and a phone drawn at the size that suits a Reel
 * runs off the bottom of a square - so they live in src/aspect.js. The sizes
 * below are the logical space a screen is authored in, and that does not
 * change with the shape: a screen is drawn once and framed three ways.
 */

export const DEVICES = {
  phone: { width: 390, height: 844 },
  desktop: { width: 720, height: 405 }
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

/* Not every desktop screen is a web page. Tally is a program that runs on the
 * owner's Windows machine: it has no address, and drawing it inside a browser
 * window with "mybillbook.in" in the bar would say something untrue about what
 * he is looking at - in a clip whose whole point is that Tally and myCashFlo
 * are separate systems that now agree with each other.
 *
 * So a desktop screen says which kind of window it is. 'browser' is the
 * default, so every laptop screen built before this is unchanged; 'app' swaps
 * the address pill for a title bar. The frame is otherwise identical, because
 * it is the same machine. */
export function chromeOf(screen) {
  return screen?.chrome === 'app' ? 'app' : 'browser';
}

/* What the window says it is when there is no address to show. */
export function titleFor(screen) {
  return screen?.windowTitle ?? 'Desktop app';
}
