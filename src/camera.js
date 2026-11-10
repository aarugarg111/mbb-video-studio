import { deviceOf, viewportFor } from './device.js';
import { ASPECTS, DEFAULT_ASPECT, DESKTOP_BOX, stageAreaHeight, scaleFor } from './aspect.js';

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

/* The shape the video is in. Every one of these takes it, because how far a
 * laptop window is pushed in and how big it is drawn are both the shape's
 * business - a 16:9 window needs a shove to fill a Reel and none at all to
 * fill a widescreen. It defaults to the vertical one, so a caller that has
 * not been told about shapes yet still gets the shape the studio always had.
 *
 * The picture below the brand strip, in frame pixels. The window may grow
 * into all of it and no further. */
export const STAGE_AREA_HEIGHT = stageAreaHeight(ASPECTS[DEFAULT_ASPECT]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Where a laptop screen sits when the shot has not asked for anything. A
 * screen may name its own point - the part of the page the clip is about -
 * and the middle is the fallback.
 *
 * How far in it rests is the SHAPE's business, not the screen's: the same
 * window needs a shove to fill a Reel and none at all to fill a widescreen.
 * A screen that names its own scale still wins, because it is saying
 * something about that page rather than about the picture.
 *
 * A screen may also say how much of ITSELF must STAY across the picture, as
 * `fit`: a width in the screen's own pixels, or 'whole' for the whole window.
 * That is a floor, and it binds the shot's zoom as well as the resting
 * position - see maxScale below.
 *
 * It exists because the push-in is a trade and on some screens it is the
 * wrong one. A 16:9 window in a 9:16 picture is a band with a lot of nothing
 * above and below, so it is pushed in until it fills the frame and its sides
 * leave it. For most screens that is right: what matters is in the middle.
 * For a TABLE it is wrong at BOTH ends - a report is a name on the left and a
 * figure on the right, and the push-in takes one of each. */
export function restingCamera(screen, aspect = ASPECTS[DEFAULT_ASPECT]) {
  if (deviceOf(screen) !== 'desktop') return null;
  const box = viewportFor(screen);
  const focus = screen?.focus ?? {};
  return {
    x: Number(focus.x ?? box.width / 2),
    y: Number(focus.y ?? box.height / 2),
    scale: Math.min(Number(focus.scale ?? aspect.framing), maxScale(screen, aspect))
  };
}

/* The furthest in the camera may go on this screen in this shape: the scale
 * at which `fit` exactly fills the picture. Infinity when the screen has not
 * asked for anything, so the cap is a no-op everywhere else.
 *
 * This is the half of `fit` that matters most, and it is about the ZOOM.
 * A shot's zoom multiplies the resting position, so "zoom to 2" on a laptop
 * is 2 x 1.26 = two and a half times in - and the studio's own guidance tells
 * the model that 2 to 2.5 reads well, because that guidance was written for
 * phones, where a zoom cannot crop anything that matters. On a laptop table
 * it cropped away the thing being zoomed TO: the Profit and Loss report
 * zoomed at Net Profit and showed neither the words "Net Profit" nor the end
 * of the number. Capping here fixes every such shot at once, including the
 * ones a model writes later, rather than asking each recipe to know better. */
export function maxScale(screen, aspect = ASPECTS[DEFAULT_ASPECT]) {
  const band = fitBand(screen);
  if (!band) return Infinity;
  return aspect.width / (band.width * scaleFor(aspect, 'desktop'));
}

/* The stretch of the screen `fit` is protecting, around the screen's own
 * focus point. Holding the WIDTH is only half of it: a zoom names its own
 * point and the camera goes there, so a cap that kept 440px on screen still
 * showed the wrong 440 - the Net Profit zoom held every figure and cut the
 * names off the front of every row. The band says which 440. */
export function fitBand(screen) {
  const focus = screen?.focus ?? {};
  if (focus.fit == null) return null;
  const width = focus.fit === 'whole' ? DESKTOP_BOX.width : Number(focus.fit);
  if (!Number.isFinite(width) || width <= 0) return null;
  const box = viewportFor(screen);
  const centre = Number(focus.x ?? box.width / 2);
  return { width, lo: centre - width / 2, hi: centre + width / 2 };
}

/* The shot's own zoom, over the resting position rather than instead of it: a
 * laptop shot that asks for 2x means twice as close as it started, not twice
 * the size of a window nobody was looking at from that far away. */
export function cameraAt(screen, zoom, aspect = ASPECTS[DEFAULT_ASPECT]) {
  const resting = restingCamera(screen, aspect);
  if (!zoom) return resting;
  if (!resting) return zoom;
  return {
    x: zoom.x, y: zoom.y,
    scale: Math.min(resting.scale * zoom.scale, maxScale(screen, aspect))
  };
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
export function windowTransform(screen, zoom, taps = [], aspect = ASPECTS[DEFAULT_ASPECT]) {
  if (deviceOf(screen) !== 'desktop') return null;
  const box = viewportFor(screen);
  const camera = cameraAt(screen, zoom, aspect);
  if (!camera) return null;
  /* How big the window is drawn in this shape. */
  const drawn = scaleFor(aspect, 'desktop');

  /* How much of the screen is still in frame, in the screen's own pixels.
   *
   * This used to read `box.width / 2 / camera.scale`, on the reasoning that
   * the window is drawn to the frame's full width so exactly its own width is
   * visible at rest. That is true in the VERTICAL shape and in neither of the
   * others - 720 screen pixels at 1.45 is 1044 of a 1080 square, and at 2.0 is
   * 1440 of a 1920 widescreen - so in those two the camera believed less was
   * on screen than really was. Worked out from the shape, as halfH already
   * was, it is right in all three. */
  const halfW = aspect.width / (drawn * camera.scale) / 2;
  const halfH = stageAreaHeight(aspect) / 2 / (drawn * camera.scale);

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

  /* Then pulled back onto whatever `fit` is protecting, which outranks both
   * the zoom's own point and the taps: a screen that said its table must stay
   * on camera means it even when the shot zooms at one cell of it. */
  const band = fitBand(screen);
  if (band) {
    const lo = band.hi - halfW;
    const hi = band.lo + halfW;
    if (lo <= hi) cx = clamp(cx, lo, hi);
  }

  /* Clamped to the window's own edges, the way a map pan is: without this a
   * push-in near an edge slides the background into frame beside it. */
  const dx = halfW >= box.width / 2 ? 0 : box.width / 2 - clamp(cx, halfW, box.width - halfW);
  const dy = halfH >= box.height / 2 ? 0 : box.height / 2 - clamp(camera.y, halfH, box.height - halfH);

  return `scale(${(drawn * camera.scale).toFixed(4)}) translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
}
