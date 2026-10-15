import { deviceOf, viewportFor } from './device.js';

/* Where the camera is, as two CSS transforms: one for the layers inside the
 * viewport, one for the window the viewport sits in.
 *
 * A phone fills the picture already, so a push-in there is a move INSIDE the
 * viewport: scaling the phone itself would grow it past its own body.
 *
 * A laptop is the opposite. Its window is 16:9 and the video is 9:16, so the
 * window is a band across the middle of the picture with a great deal of
 * nothing above and below it. Pushing in inside that band magnifies the
 * content and leaves the band exactly as small as it was - the thing that
 * needed fixing is the one thing it cannot change. So on a laptop the camera
 * moves the WINDOW: it grows past the sides of the frame, the way a screen
 * recording in a Reel does, and the picture fills up.
 *
 * Both renderers call this. The maths was written out twice before, once in
 * stage/stage.js and once in web/lib/render.ts, which is the arrangement that
 * had the browser and the command line disagreeing about what a frame looked
 * like.
 */

/* The picture below the logo band, in device pixels. The window may grow into
 * all of it and no further. */
export const STAGE_AREA_HEIGHT = 1770;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Where a laptop screen sits when the shot has not asked for anything. A
 * screen may name its own point - the part of the page the clip is about -
 * and the middle is the fallback. */
export function restingCamera(screen) {
  const box = viewportFor(screen);
  if (!box.framing) return null;
  const focus = screen?.focus ?? {};
  return {
    x: Number(focus.x ?? box.width / 2),
    y: Number(focus.y ?? box.height / 2),
    scale: Number(focus.scale ?? box.framing)
  };
}

/* The shot's own zoom, over the resting position rather than instead of it: a
 * laptop shot that asks for 2x means twice as close as it started, not twice
 * the size of a window nobody was looking at from that far away. */
export function cameraAt(screen, zoom) {
  const resting = restingCamera(screen);
  if (!zoom) return resting;
  if (!resting) return zoom;
  return { x: zoom.x, y: zoom.y, scale: resting.scale * zoom.scale };
}

/* The transform for the layers inside the viewport. Phones only - see above. */
export function innerTransform(screen, zoom) {
  if (!zoom || deviceOf(screen) === 'desktop') return null;
  const box = viewportFor(screen);
  const dx = clamp(box.width / 2 - zoom.x * zoom.scale, box.width * (1 - zoom.scale), 0);
  const dy = clamp(box.height / 2 - zoom.y * zoom.scale, box.height * (1 - zoom.scale), 0);
  return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${zoom.scale.toFixed(4)})`;
}

/* The transform for the whole window. Laptops only. It carries the window's
 * own scale as well, because an inline transform replaces the one in the
 * stylesheet rather than adding to it. */
export function windowTransform(screen, zoom, taps = []) {
  if (deviceOf(screen) !== 'desktop') return null;
  const box = viewportFor(screen);
  const camera = cameraAt(screen, zoom);
  if (!camera) return null;

  /* How much of the screen is still in frame, in the screen's own pixels. The
   * window is drawn to the frame's full width, so at rest exactly the width of
   * it is visible and the push-in eats into that. */
  const halfW = box.width / 2 / camera.scale;
  const halfH = STAGE_AREA_HEIGHT / 2 / (box.scale * camera.scale);

  /* Moved as little as it takes to hold what this shot taps. A laptop window
   * is wider than the picture, so a button near an edge can sit outside the
   * frame, and a tap on it is a ring nobody sees - which is what happened to
   * the button that starts a laptop bill. The margin keeps it off the very
   * edge of the picture. */
  const edge = 18;
  let cx = camera.x;
  for (const tap of taps) {
    if (tap.x < cx - halfW + edge) cx = tap.x + halfW - edge;
    else if (tap.x > cx + halfW - edge) cx = tap.x - halfW + edge;
  }

  /* Clamped to the window's own edges, the way a map pan is: without this a
   * push-in near an edge slides the background into frame beside it. */
  const dx = halfW >= box.width / 2 ? 0 : box.width / 2 - clamp(cx, halfW, box.width - halfW);
  const dy = halfH >= box.height / 2 ? 0 : box.height / 2 - clamp(camera.y, halfH, box.height - halfH);

  return `scale(${(box.scale * camera.scale).toFixed(4)}) translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
}
