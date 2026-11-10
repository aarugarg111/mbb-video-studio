/* Everything the rasteriser needs, as bytes.
 *
 * An SVG rasterised from a data: URL is a separate document with no access to
 * this page's network. A font or image referenced by path simply does not
 * load, and the failure is silent - text falls back to a system face and
 * images vanish. So it all gets embedded. */

import { asset } from './base-path';
import { STAGE_CSS } from './stage-css';

export type Assets = {
  css: string;
  fontFaces: string;
  logoDataUrl: string;
  /* null when kit/cta/download-now.png has not been supplied. */
  ctaDataUrl: string | null;
};

export const CTA_PATH = '/kit/cta/download-now.png';

export const FONT_SUBSETS = [
  { name: 'latin', file: 'dm-sans-latin.woff2', range: 'U+0000-00FF,U+0131,U+2000-206F,U+20B9,U+2122' },
  { name: 'latin-ext', file: 'dm-sans-latin-ext.woff2', range: 'U+0100-024F,U+20B9' }
] as const;

export function buildFontFaces(base64BySubset: Record<string, string>): string {
  return FONT_SUBSETS.map(s =>
    `@font-face{font-family:"DM Sans";` +
    `src:url(data:font/woff2;base64,${base64BySubset[s.name] ?? ''}) format("woff2");` +
    `font-weight:100 1000;font-style:normal;font-display:block;` +
    `unicode-range:${s.range};}`
  ).join('');
}

/* Every asset request names its file when it goes wrong.
 *
 * A bad STATUS already named it. A request that fails at network level -
 * offline, blocked by an extension, a proxy cutting it off - threw the
 * browser's bare "Failed to fetch" instead, which contains no URL at all.
 * That is what came back from the live studio: "Failed to fetch" at the
 * render stage, naming neither the file, nor the step, nor anything to try,
 * for any one of six requests.
 *
 * The URL is the whole diagnosis, so it goes into the message either way. */
async function get(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(
      `Could not load ${url} - the request did not complete. That is usually this ` +
      `network, a browser extension blocking it, or being offline. ` +
      `(${(err as Error)?.message ?? String(err)})`
    );
  }
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  return res;
}

async function fetchBase64(url: string): Promise<string> {
  const bytes = new Uint8Array(await (await get(url)).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchText(url: string): Promise<string> {
  return (await get(url)).text();
}


/* Whether the CTA artwork is supplied. A static host may answer a missing file
 * with an HTML page, so check the type as well as the status. */
export async function ctaImageExists(): Promise<boolean> {
  try {
    const res = await fetch(asset(CTA_PATH), { method: 'HEAD' });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

let cached: Promise<Assets> | null = null;

/* Memoised: several hundred frames must not refetch the fonts.
 *
 * A FAILED load is forgotten, though. The rejected promise used to stay in
 * here for the life of the page, so one dropped connection meant every
 * render afterwards failed with the same stale error - pressing the button
 * again could not possibly work, and nothing said why. A render that fails
 * on the network has to be retryable, because that is the whole reason
 * somebody presses it twice. */
export function loadAssets(): Promise<Assets> {
  if (cached) return cached;

  cached = (async () => {
    const [tokens, kit, logo, cta, ...fonts] = await Promise.all([
      fetchText(asset('/kit/tokens.css')),
      fetchText(asset('/kit/kit.css')),
      fetchBase64(asset('/kit/brand/mybillbook-logo-reverse.png')),
      fetchBase64(asset(CTA_PATH)).catch(() => null),
      ...FONT_SUBSETS.map(s => fetchBase64(asset(`/kit/fonts/${s.file}`)))
    ]);

    const bySubset: Record<string, string> = {};
    FONT_SUBSETS.forEach((s, i) => { bySubset[s.name] = fonts[i]; });

    return {
      css: tokens + kit + STAGE_CSS,
      fontFaces: buildFontFaces(bySubset),
      logoDataUrl: `data:image/png;base64,${logo}`,
      ctaDataUrl: cta ? `data:image/png;base64,${cta}` : null
    };
  })();

  /* Drop it on failure so the next attempt really is an attempt. The catch
     re-throws: this clears the cache, it does not swallow the error. */
  cached.catch(() => { cached = null; });

  return cached;
}

/* The theme art, embedded, for the themes a given clip can actually show.
 *
 * The rasterised SVG is a separate document with no access to this page's
 * network, so a background-image pointing at a file loads nothing and says
 * nothing about it - the art would be perfect on screen and absent from the
 * video. Everything else here is embedded for exactly that reason; this is
 * the same move for the one asset that varies per recipe.
 *
 * Only what the recipe can reach: the art is inlined into every frame, so
 * carrying all sixteen festivals would mean about a megabyte and a half
 * repeated several hundred times.
 *
 * A festival with no art supplied yet simply gets no variable, and the tinted
 * card behind it shows through - which is what happens on screen too. */
export async function themeArtCss(used: { slug: string; variant: number }[]): Promise<string> {
  const rules = await Promise.all(used.map(async ({ slug, variant }) => {
    const base = variant === 2 ? `${slug}-2` : slug;
    /* .jpg first, then .png, then the festival's own art if the variant has
       none - the same order the stylesheet falls back in. */
    for (const name of [`${base}.jpg`, `${base}.png`, `${slug}.jpg`, `${slug}.png`]) {
      const type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      try {
        const data = await fetchBase64(asset(`/kit/themes/${name}`));
        return `--theme-art-${slug}-${variant}:url(data:${type};base64,${data});`;
      } catch {
        /* not supplied - try the next name */
      }
    }
    return '';
  }));

  const body = rules.filter(Boolean).join('');
  return body ? `:root{${body}}` : '';
}
