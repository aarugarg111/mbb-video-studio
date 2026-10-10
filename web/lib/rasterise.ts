import type { Assets } from './assets';

/* Turns the live DOM of one screen into markup an SVG foreignObject will
 * accept. Pure, so the three fixes below can be tested without a browser -
 * each of them fails silently in production, which is exactly why they are
 * tested rather than eyeballed. */
const NAMED_ENTITY = /&([a-zA-Z][a-zA-Z0-9]*);/g;
const XML_SAFE = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

/* The ones that can reach here: what the DOM serializer emits, plus the few a
 * screen is likely to write by hand. */
const NAMED_CODES: Record<string, number> = {
  nbsp: 160, middot: 183, rsquo: 8217, lsquo: 8216, rdquo: 8221, ldquo: 8220,
  rsaquo: 8250, lsaquo: 8249, ndash: 8211, mdash: 8212, hellip: 8230,
  times: 215, deg: 176
};

export function prepareHtml(outerHtml: string, logoDataUrl: string, ctaDataUrl: string | null = null): string {
  let html = outerHtml;

  /* 1. Inside foreignObject everything inherits the XHTML namespace, so a
   *    bare <svg> is an unknown XHTML element and draws nothing at all. */
  html = html.replace(/<svg\b(?![^>]*\bxmlns=)/g, '<svg xmlns="http://www.w3.org/2000/svg"');

  /* 2. foreignObject content is parsed as XML, where void elements must be
   *    explicitly closed or the whole frame fails to parse. */
  html = html.replace(/<(img|br|hr|input)\b([^>]*?)(?<!\/)>/g, '<$1$2/>');

  /* 3. The logo is referenced by path, which the rasterised document cannot
   *    reach. */
  html = html.replace(
    /src="[^"]*mybillbook-logo-reverse\.png"/g,
    `src="${logoDataUrl}"`
  );

  /* 4. So is the download CTA artwork. Same silent failure: a path reference
   *    draws nothing and raises no error. */
  if (ctaDataUrl) {
    html = html.replace(/src="[^"]*download-now\.png"/g, `src="${ctaDataUrl}"`);
  }

  /* 5. XML knows five entity names - amp, lt, gt, quot, apos - and no others.
   *    HTML knows hundreds, and the DOM serializer emits one of them: a
   *    non-breaking space comes back out of outerHTML as "&nbsp;", whatever
   *    the source wrote. In XML that is an undefined entity, and an undefined
   *    entity does not degrade - it makes the whole document unparseable, so
   *    EVERY frame fails with "the source image cannot be decoded" and nothing
   *    says which character or which screen. The CLI path parses the same
   *    markup as HTML and is perfectly happy, so this breaks the browser alone.
   *
   *    Numeric references mean the same thing and are valid in both. */
  html = html.replace(NAMED_ENTITY, (whole, name) => {
    if (XML_SAFE.has(name)) return whole;
    const code = NAMED_CODES[name];
    /* An entity nobody anticipated would still take the whole frame down, so
     * it is dropped instead - a missing character beats a missing video. */
    return code ? `&#${code};` : '';
  });

  return html;
}

/* Inside foreignObject the <style> element is XML, not HTML: its text is
 * parsed, so a literal < or & anywhere in the stylesheet makes the entire
 * frame undecodable, with nothing to say which frame or which rule. A
 * "<slug>" inside a CSS comment was the real case. The CLI path parses the
 * same stylesheet as HTML, where both characters are harmless, so this
 * breaks the browser alone and breaks it silently. Escaping restores them
 * as text, and the CSS parser then sees the stylesheet unchanged. */
export function escapeStyleText(css: string): string {
  return css.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/* Rasterises a live element at its natural size. The browser performs the
 * layout and painting, which is why this matches a real screenshot. */
export async function rasterise(
  node: HTMLElement,
  assets: Assets,
  w: number,
  h: number
): Promise<HTMLImageElement> {
  const html = prepareHtml(node.outerHTML, assets.logoDataUrl, assets.ctaDataUrl);
  const style = escapeStyleText(assets.fontFaces + assets.css);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml"><style>${style}</style>${html}</div>` +
    `</foreignObject></svg>`;

  const img = new Image(w, h);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  return img;
}
