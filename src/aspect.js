/* What shape the finished video is.
 *
 * The studio made one shape: 1080x1920, because that is what a Reel and a
 * Short are. The same clip gets posted to a feed, where a square wastes less
 * of the screen, and to YouTube proper, where a vertical video is a strip
 * down the middle between two grey walls. Re-cutting it by hand afterwards
 * crops the thing the clip is about, because the interface is in the middle
 * and the crop does not know that.
 *
 * So the shape is something the recipe asks for and the stage is built to,
 * and every frame is composed for it from the start.
 *
 * What changes between them is not only the frame. A phone is tall and a
 * laptop window is wide, so how big each has to be drawn to sit well in the
 * picture is different in each shape - and so is how far the camera pushes
 * into a laptop window before the clip has asked for anything. Those are the
 * numbers below. They are not derived from the frame size by formula: a
 * formula would give the right arithmetic and the wrong picture.
 *
 *   band     the brand strip across the top, in pixels
 *   logo     how wide the logo is drawn in it
 *   phone    what the phone body is scaled by
 *   desktop  what the laptop window is scaled by
 *   framing  where the camera rests on a laptop, before any zoom
 *
 * The phone's and the laptop's own logical sizes do NOT change - see
 * src/device.js. A screen is authored once and drawn at whatever size the
 * shape asks for, so no screen knows about any of this.
 */

/* The phone body and the laptop window, including their own chrome. Kept
 * here because the scales below were chosen against them: a change to the
 * phone's padding or the window's title bar moves what fits. MEASURED - see
 * test/aspect.test.js, which measures them again in a browser. */
export const PHONE_BOX = { width: 412, height: 866 };
export const DESKTOP_BOX = { width: 736, height: 443 };

export const ASPECTS = {
  /* Reels, Shorts, status. The shape the studio was built for, unchanged. */
  '9:16': {
    name: 'Vertical', where: 'Reels, Shorts, status',
    width: 1080, height: 1920,
    band: 150, logo: 300,
    phone: 1.8, desktop: 1.5,
    /* A 16:9 window in a 9:16 picture is a band across the middle with a
       great deal of nothing above and below, so it is pushed in on until it
       fills the picture and its sides go out of frame - which is what a
       screen recording in a Reel does too. */
    framing: 1.26,
    endcardLogo: 420, tagline: 38
  },

  /* A feed post. Wastes less of the screen than a vertical video does in a
     feed, and is still tall enough to hold a phone. */
  '1:1': {
    name: 'Square', where: 'Instagram and Facebook feed',
    width: 1080, height: 1080,
    band: 120, logo: 260,
    phone: 1.05, desktop: 1.45,
    /* None, unlike the vertical. A square is wide enough to hold a whole
       16:9 window across it, so there is nothing to fill by pushing in -
       and a push-in here cuts off the left rail, which is where a laptop
       screen keeps the part that says which app this is. Bands above and
       below a whole window read as a window; a sliced rail reads as a
       mistake. */
    framing: 1,
    endcardLogo: 360, tagline: 34
  },

  /* YouTube proper, a website, a deck. The laptop clips are at home here;
     a phone in it is a tall object in a wide picture and stays small, which
     is true of every phone in every horizontal video ever shot. */
  '16:9': {
    name: 'Horizontal', where: 'YouTube, a website, a deck',
    width: 1920, height: 1080,
    band: 120, logo: 280,
    phone: 1.04, desktop: 2.0,
    /* None. The window and the picture are the same shape, so there is
       nothing to push past - and pushing in would only crop it. */
    framing: 1,
    endcardLogo: 420, tagline: 38
  }
};

export const DEFAULT_ASPECT = '9:16';

/* What a person might write for each, beyond its own name. A script says
 * "square" or "landscape", not "1:1", and a recipe that has to remember the
 * ratio would get it wrong. */
const ALSO_CALLED = {
  '9:16': ['vertical', 'portrait', 'reel', 'reels', 'short', 'shorts', 'story', '1080x1920'],
  '1:1': ['square', 'feed', 'post', '1080x1080'],
  '16:9': ['horizontal', 'landscape', 'wide', 'youtube', 'desktop', '1920x1080']
};

/* The name of the shape, from whatever was written. null if it is not one. */
export function aspectNamed(value) {
  const asked = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!asked) return null;
  if (ASPECTS[asked]) return asked;
  /* "16x9" and "16/9" are the same request as "16:9". */
  const loose = asked.replace(/[x\/]/g, ':');
  if (ASPECTS[loose]) return loose;
  for (const [id, names] of Object.entries(ALSO_CALLED)) {
    if (names.includes(asked)) return id;
  }
  return null;
}

export const ASPECT_NAMES = [
  ...Object.keys(ASPECTS),
  ...Object.values(ALSO_CALLED).flat()
];

/* The shape a recipe is in. Anything that does not say is vertical, which
 * keeps every recipe written before this unchanged. */
export function aspectOf(recipe) {
  return ASPECTS[aspectNamed(recipe?.aspect) ?? DEFAULT_ASPECT];
}

/* The picture below the brand strip. The laptop window may grow into all of
 * it and no further. */
export function stageAreaHeight(aspect) {
  return aspect.height - aspect.band;
}

/* How big a device is drawn in this shape. */
export function scaleFor(aspect, device) {
  return device === 'desktop' ? aspect.desktop : aspect.phone;
}

/* The shape, as the custom properties the stage is built out of.
 *
 * One function rather than one per renderer. The command line writes these
 * onto the stage page and the browser writes them into the SVG's own style
 * block, and the two have to agree down to the pixel or the same recipe
 * gives two different videos - which is the failure this studio has had
 * before, and which nothing catches because both outputs look fine on their
 * own. */
export function cssVarsFor(aspect) {
  return {
    '--frame-w': `${aspect.width}px`,
    '--frame-h': `${aspect.height}px`,
    '--band-h': `${aspect.band}px`,
    '--band-logo': `${aspect.logo}px`,
    '--phone-scale': String(aspect.phone),
    '--desktop-scale': String(aspect.desktop),
    '--endcard-logo': `${aspect.endcardLogo}px`,
    '--endcard-tagline': `${aspect.tagline}px`
  };
}

/* The same thing as a block of CSS, for the renderer that has no DOM to set
 * properties on. */
export function cssTextFor(aspect) {
  return ':root {\n' + Object.entries(cssVarsFor(aspect))
    .map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';
}
