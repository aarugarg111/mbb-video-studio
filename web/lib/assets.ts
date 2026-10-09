/* Everything the rasteriser needs, as bytes.
 *
 * An SVG rasterised from a data: URL is a separate document with no access to
 * this page's network. A font or image referenced by path simply does not
 * load, and the failure is silent - text falls back to a system face and
 * images vanish. So it all gets embedded. */

import { asset } from './base-path';

export type Assets = {
  css: string;
  fontFaces: string;
  logoDataUrl: string;
};

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

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  return res.text();
}


let cached: Promise<Assets> | null = null;

/* Memoised: several hundred frames must not refetch the fonts. */
export function loadAssets(): Promise<Assets> {
  if (cached) return cached;

  cached = (async () => {
    const [tokens, kit, logo, ...fonts] = await Promise.all([
      fetchText(asset('/kit/tokens.css')),
      fetchText(asset('/kit/kit.css')),
      fetchBase64(asset('/kit/brand/mybillbook-logo-reverse.png')),
      ...FONT_SUBSETS.map(s => fetchBase64(asset(`/kit/fonts/${s.file}`)))
    ]);

    const bySubset: Record<string, string> = {};
    FONT_SUBSETS.forEach((s, i) => { bySubset[s.name] = fonts[i]; });

    return {
      css: tokens + kit,
      fontFaces: buildFontFaces(bySubset),
      logoDataUrl: `data:image/png;base64,${logo}`
    };
  })();

  return cached;
}
