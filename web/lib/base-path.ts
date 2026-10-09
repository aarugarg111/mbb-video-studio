/* GitHub Pages serves a project repository under /<repo>/, so every
 * root-absolute asset URL would 404 there.
 *
 * This is not cosmetic. If the kit stylesheets fail to load, the page still
 * renders - just unstyled - and every frame is then laid out and captured
 * with the wrong geometry. The video comes out broken with nothing in the
 * console to explain why. One helper, used everywhere an asset is referenced.
 */

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

export function asset(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
