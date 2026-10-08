/* Recipe text reaches the screens as data and must never become markup.
 * Lives here rather than on one screen so no screen has to import from a
 * sibling screen to get it. */

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
