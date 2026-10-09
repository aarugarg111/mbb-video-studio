import type { Assets } from './assets';

/* Turns the live DOM of one screen into markup an SVG foreignObject will
 * accept. Pure, so the three fixes below can be tested without a browser -
 * each of them fails silently in production, which is exactly why they are
 * tested rather than eyeballed. */
export function prepareHtml(outerHtml: string, logoDataUrl: string): string {
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

  return html;
}

/* Rasterises a live element at its natural size. The browser performs the
 * layout and painting, which is why this matches a real screenshot. */
export async function rasterise(
  node: HTMLElement,
  assets: Assets,
  w: number,
  h: number
): Promise<HTMLImageElement> {
  const html = prepareHtml(node.outerHTML, assets.logoDataUrl);
  const style = assets.fontFaces + assets.css;

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
