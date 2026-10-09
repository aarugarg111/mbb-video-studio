/* Inline SVG icons for the screens. All strokes use currentColor, so the colour
 * comes from CSS (a token), never from a literal here. */

const svg = (size, body, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const icons = {
  back: (s = 24) => svg(s, '<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  search: (s = 22) => svg(s, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  close: (s = 20) => svg(s, '<path d="M6 6l12 12M18 6L6 18"/>'),
  scan: (s = 26) => svg(s, '<path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4M3 12h18"/>'),
  mic: (s = 26) => svg(s, '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  chevDown: (s = 16) => svg(s, '<path d="M6 9l6 6 6-6"/>'),
  plus: (s = 16) => svg(s, '<path d="M12 5v14M5 12h14"/>'),
  minus: (s = 16) => svg(s, '<path d="M5 12h14"/>'),
  /* The dashboard tiles used the Unicode arrows U+2193/U+2191, which are not
   * in the embedded DM Sans subsets - so each machine drew them in whatever
   * system font it happened to fall back to. Drawn here instead, they are the
   * same everywhere. */
  arrowDown: (s = 15) => svg(s, '<path d="M12 5v14M6 13l6 6 6-6"/>'),
  arrowUp: (s = 15) => svg(s, '<path d="M12 19V5M6 11l6-6 6 6"/>'),
  person: (s = 24) => svg(s, '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>', 'stroke-width="1.6"'),
  docSettings: (s = 26) => svg(s, '<path d="M6 3h9l4 4v6M6 3v18h8"/><path d="M9 10h5M9 14h3"/><circle cx="18" cy="17" r="2.5"/>', 'stroke-width="1.7"'),
  edit: (s = 26) => svg(s, '<path d="M4 20l1-4 11-11 3 3L8 19l-4 1zM14 7l3 3"/>', 'stroke-width="1.8"'),
  trash: (s = 26) => svg(s, '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11l4 5M14 11l-4 5"/>', 'stroke-width="1.8"'),
  more: (s = 26) => svg(s, '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>'),
  print: (s = 26) => svg(s, '<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z"/>', 'stroke-width="1.7"'),
  download: (s = 26) => svg(s, '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', 'stroke-width="1.8"'),
  share: (s = 26) => svg(s, '<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8.2 11l6.6-3.8M8.2 13l6.6 3.8"/>', 'stroke-width="1.7"')
};
