/* Spotting a hard-coded colour in rendered markup.
 *
 * Every screen must take its colours from a token. The guard that enforces
 * that used to look for "#" followed by hex digits, which is also what an
 * invoice number looks like: #486 broke it once and #212 broke it again, and
 * both times the answer was to renumber the invoice - which fixes the test and
 * leaves the trap armed for whoever picks 212 next.
 *
 * A colour in markup only ever appears inside an ATTRIBUTE: in a style, or as
 * a whole attribute value. An invoice number is text between tags. So this
 * looks where colours live rather than for things shaped like colours, and
 * "Sales Invoice #212" is no longer a colour however it is numbered.
 */

const STYLE_ATTR = /style\s*=\s*"([^"]*)"/gi;
const COLOUR_ATTR = /\b(?:fill|stroke|color|bgcolor)\s*=\s*"(#[0-9a-fA-F]{3,8})"/gi;
const IN_VALUE = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g;

/* Every hard-coded colour in the markup, for a message that says which. */
export function rawColoursIn(markup) {
  const text = String(markup ?? '');
  const found = [];

  for (const [, style] of text.matchAll(STYLE_ATTR)) {
    for (const hit of style.match(IN_VALUE) ?? []) found.push(hit);
  }
  for (const [, value] of text.matchAll(COLOUR_ATTR)) found.push(value);

  return [...new Set(found)];
}

export function hasRawColour(markup) {
  return rawColoursIn(markup).length > 0;
}
