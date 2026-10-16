/* The sixteen festive invoice themes the app sells, in the order the Theme
 * Store shows them (reference/frames/th-9.0.png and th-15.0.png). The slug is
 * the file name in kit/themes/ and the value a recipe puts in invoice.theme. */
export const FESTIVE_THEMES = [
  ['navaratri', 'Navaratri'], ['durga-puja', 'Durga Puja'], ['dussehra', 'Dussehra'],
  ['dhanteras', 'Dhanteras'], ['diwali', 'Diwali'], ['chhath-puja', 'Chhath Puja'],
  ['gandhi-jayanti', 'Gandhi Jayanti'], ['ganesh-chaturthi', 'Ganesh Chaturthi'],
  ['janmashtami', 'Janmashtami'], ['rakhi', 'Rakhi'], ['onam', 'Onam'],
  ['eid-e-milad', 'Eid-e-Milad'], ['independence', 'Independence'],
  ['shubh-ekadashi', 'Shubh Ekadashi'], ['jain-theme', 'Jain theme'], ['industrial', 'Industrial']
].map(([slug, name]) => ({ slug, name }));

export const THEME_SLUGS = FESTIVE_THEMES.map(t => t.slug);

/* Where a theme's picture lives, and what to fall back to.
 *
 * It lives here rather than in theme-store.js because the bill needs it too,
 * and theme-store.js already draws the bill - putting it there would have made
 * the two import each other.
 *
 * Four files are named rather than one, and the order matters: CSS paints
 * background layers front to back and simply skips one that does not load. So
 * the chosen variant wins where it exists, the festival's main picture is used
 * where it does not, and the tint behind shows through for a festival whose
 * art has not been supplied at all. That is what lets a half-delivered set
 * look deliberate rather than broken.
 *
 * Both extensions because this art is photographic: FloBiz supplies JPEGs, and
 * a JPEG of one of these illustrations is about a tenth the size of the same
 * thing as a PNG - which matters when the Theme Store loads sixteen at once.
 * ".png" stays first-class because that is what kit/themes/README.md has
 * always told people to supply.
 *
 * "variant" is the second artwork for a festival, which is what the Theme
 * Store's two chips choose between. A festival with only one picture shows
 * that one for both chips instead of going blank on the second. */
export function themeArtUrl(slug, variant = 1) {
  const v = Number(variant) === 2 ? 2 : 1;
  const base = v === 2 ? `${slug}-2` : slug;
  const files = [
    `url(../kit/themes/${base}.jpg)`,
    `url(../kit/themes/${base}.png)`,
    `url(../kit/themes/${slug}.jpg)`,
    `url(../kit/themes/${slug}.png)`
  ].join(', ');

  /* The custom property is how the BROWSER renderer gets the picture in.
   * What it rasterises is a separate document with no network, so a file path
   * there loads nothing and fails silently - the art would simply be absent
   * from the video while looking perfect on the page. That renderer defines
   * these variables with the image embedded as data; the command line leaves
   * them undefined and the file paths behind the comma are used instead. */
  return `var(--theme-art-${slug}-${v}, ${files})`;
}

/* Which theme art a recipe can possibly show, so the browser renderer embeds
 * those and not all sixteen.
 *
 * It has to look at the shots as well as the invoice, because a clip can walk
 * into the Theme Store and CHANGE the theme on camera - that is what the
 * screen is for. A tap on theme-3 is whatever the fourth festival is.
 *
 * Embedding everything instead would be simpler and much worse: the art is
 * inlined into every single frame of the video, so sixteen festivals is about
 * a megabyte and a half carried six hundred times. */
export function themesUsedBy(recipe) {
  const slugs = new Set();
  const add = slug => { if (slug && slug !== 'none' && slug !== 'warm') slugs.add(slug); };

  add(recipe?.invoice?.theme);

  let variant = 1;
  for (const shot of recipe?.shots ?? []) {
    for (const action of shot?.actions ?? []) {
      const target = String(action?.target ?? '');
      const picked = target.match(/^theme-(\d+)$/);
      if (picked) add(FESTIVE_THEMES[Number(picked[1])]?.slug);
      if (target === 'variant-2') variant = 2;
    }
  }

  /* Both variants when the clip touches the second chip: it starts on the
   * first and changes, so both are on screen at some point. */
  const out = [];
  for (const slug of slugs) {
    out.push({ slug, variant: 1 });
    if (variant === 2) out.push({ slug, variant: 2 });
  }
  return out;
}
