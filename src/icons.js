/* Inline SVG icons for the screens. All strokes use currentColor, so the colour
 * comes from CSS (a token), never from a literal here. */

const svg = (size, body, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const icons = {
  back: (s = 24) => svg(s, '<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  search: (s = 22) => svg(s, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  store: (s = 24) => svg(s, '<path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20"/>', 'stroke-width="1.6"'),
  info: (s = 20) => svg(s, '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/>', 'stroke-width="1.6"'),
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
  share: (s = 26) => svg(s, '<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8.2 11l6.6-3.8M8.2 13l6.6 3.8"/>', 'stroke-width="1.7"'),
  /* Items and Create New Item screens. */
  settings: (s = 24) => svg(s, '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5l1.6 2.6 3-.6.6 3 2.6 1.6-1.6 2.6 1.6 2.6-2.6 1.6-.6 3-3-.6L12 21.5l-1.6-2.6-3 .6-.6-3-2.6-1.6 1.6-2.6-1.6-2.6 2.6-1.6.6-3 3 .6z"/>', 'stroke-width="1.7"'),
  sliders: (s = 22) => svg(s, '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="15" cy="6" r="2" fill="var(--mbb-surface)"/><circle cx="9" cy="12" r="2" fill="var(--mbb-surface)"/><circle cx="15" cy="18" r="2" fill="var(--mbb-surface)"/>', 'stroke-width="1.8"'),
  filter: (s = 16) => svg(s, '<path d="M3 7h18M6 12h12M10 17h4"/>', 'stroke-width="2"'),
  plusCircle: (s = 24) => svg(s, '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 7v10M7 12h10" stroke="var(--mbb-primary)"/>'),
  /* The Parties app bar, where it opens shared ledgers. */
  linkChain: (s = 22) => svg(s, '<path d="M10 13a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 11a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 5.7 5.7l1.1-1.1"/>', 'stroke-width="1.9"'),
  ledger: (s = 22) => svg(s, '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>', 'stroke-width="1.8"'),
  /* WhatsApp's handset-in-a-bubble, drawn rather than imported: it is a
   * generic glyph here, and an image would need a licence and a network
   * fetch the rasteriser cannot make. */
  whatsapp: (s = 22) => svg(s, '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M9 8.5c.4-.1.7 0 .9.4l.6 1.2c.1.3 0 .6-.2.8l-.4.4a5.5 5.5 0 0 0 2.8 2.8l.4-.4c.2-.2.5-.3.8-.2l1.2.6c.4.2.5.5.4.9-.2.8-1 1.3-1.9 1.2A7.6 7.6 0 0 1 7.8 10c-.1-.9.4-1.3 1.2-1.5z"/>', 'stroke-width="1.5"'),
  /* myCashFlo's own set. It is a different product with a different bottom
   * bar - collections, not billing - so these do not overlap the nav icons
   * above and are kept together. */
  phone: (s = 22) => svg(s, '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 7.2 2 2 0 0 1 6 5z"/>', 'stroke-width="1.7"'),
  phoneOff: (s = 22) => svg(s, '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 7.2 2 2 0 0 1 6 5z"/><path d="M3 3l18 18"/>', 'stroke-width="1.7"'),
  legal: (s = 22) => svg(s, '<path d="M6 3h8l4 4v14H6z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/>', 'stroke-width="1.7"'),
  wallet: (s = 22) => svg(s, '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M3 7.5h16a2 2 0 0 1 2 2V12h-4.5a2 2 0 0 0 0 4H21"/>', 'stroke-width="1.7"'),
  calendar: (s = 18) => svg(s, '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/><circle cx="8.5" cy="13.5" r="1" fill="currentColor"/><circle cx="12" cy="13.5" r="1" fill="currentColor"/><circle cx="15.5" cy="13.5" r="1" fill="currentColor"/>', 'stroke-width="1.7"'),
  clock: (s = 20) => svg(s, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>', 'stroke-width="1.8"'),
  warning: (s = 20) => svg(s, '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.6" r="0.7" fill="currentColor"/>', 'stroke-width="1.8"'),
  /* The four across myCashFlo's bottom bar. */
  mcfDashboard: (s = 24) => svg(s, '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>', 'stroke-width="1.8"'),
  mcfParties: (s = 24) => svg(s, '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20c0-3.6 2.9-5.5 6.5-5.5S16 16.4 16 20"/><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2.1.7 3.5 2.4 3.5 5.2"/>', 'stroke-width="1.7"'),
  mcfAutomations: (s = 24) => svg(s, '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><circle cx="17.5" cy="17.5" r="3.5"/><path d="M7 10.5v5a3 3 0 0 0 3 3h3.5"/>', 'stroke-width="1.7"'),
  dots: (s = 18) => svg(s, '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>'),
  sync: (s = 18) => svg(s, '<path d="M20 11a8 8 0 0 0-13.7-5.2L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 13.7 5.2L20 16"/><path d="M20 20v-4h-4"/>', 'stroke-width="1.9"'),
  pause: (s = 20) => svg(s, '<path d="M9.5 5v14M14.5 5v14"/>', 'stroke-width="2.2"'),
  folderUp: (s = 24) => svg(s, '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 17v-6M9 13.5l3-3 3 3"/>', 'stroke-width="1.7"'),
  navDashboard: (s = 24) => svg(s, '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>', 'stroke-width="1.6"'),
  navParties: (s = 24) => svg(s, '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>', 'stroke-width="1.6"'),
  navItems: (s = 24) => svg(s, '<rect x="4" y="12" width="7" height="7" rx="1" fill="currentColor"/><rect x="13" y="12" width="7" height="7" rx="1" fill="currentColor"/><rect x="8.5" y="4" width="7" height="7" rx="1" fill="currentColor"/>', 'stroke-width="1"'),
  navForYou: (s = 24) => svg(s, '<circle cx="15" cy="7" r="3"/><path d="M3 20l4-5 5 1 6 2M3 15h5"/>', 'stroke-width="1.6"'),
  navMore: (s = 24) => svg(s, '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', 'stroke-width="1.6"'),
  /* Android and WhatsApp screens (share-sheet, wa-attach, wa-chat). */
  group: (s = 22) => svg(s, '<circle cx="9" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="2.4" fill="currentColor" stroke="none"/><path d="M3 19c0-3.5 2.7-5 6-5s6 1.5 6 5zM15.5 14.4c3 0 5.5 1.2 5.5 4.6h-4" fill="currentColor" stroke="none"/>'),
  personAdd: (s = 24) => svg(s, '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M19 5v6M16 8h6"/>', 'stroke-width="1.7"'),
  check: (s = 18) => svg(s, '<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  doubleCheck: (s = 16) => svg(s, '<path d="M1.5 13l4.5 4.5L15 8M10 16.5l1 1L21 8"/>', 'stroke-width="2"'),
  send: (s = 24) => svg(s, '<path d="M3 4l18 8-18 8 2.5-8z" fill="currentColor"/>', 'stroke-width="1"'),
  attach: (s = 24) => svg(s, '<path d="M21.4 11.05l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.65 5.65l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>', 'stroke-width="1.8"'),
  camera: (s = 24) => svg(s, '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13" r="3.4"/>', 'stroke-width="1.7"'),
  rupeeCircle: (s = 24) => svg(s, '<circle cx="12" cy="12" r="9"/><path d="M8.5 8h7M8.5 11h7M8.5 8c4.5 0 4.5 6.5 0 6.5l4.5 3"/>', 'stroke-width="1.7"'),
  sticker: (s = 24) => svg(s, '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 2.4 3 4 3s3-1 4-3M9 9.5h.01M15 9.5h.01" stroke-linecap="round"/>', 'stroke-width="1.7"'),
  videoCall: (s = 24) => svg(s, '<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>', 'stroke-width="1.8"'),
  /* The red PDF tile WhatsApp draws for a document. The label is SVG text in
   * ordinary ASCII, so it needs no glyph outside the embedded font. */
  pdfFile: (s = 40) =>
    '<svg width="' + s + '" height="' + s + '" viewBox="0 0 40 40" fill="none">' +
    '<path d="M7 2h20l8 8v26a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--wa-pdf)"/>' +
    '<path d="M27 2l8 8h-6a2 2 0 0 1-2-2z" fill="var(--wa-pdf-fold)"/>' +
    '<text x="20" y="28" text-anchor="middle" font-size="11" font-weight="700" fill="var(--wa-text)" font-family="var(--mbb-font)">PDF</text></svg>',
  /* Android system bars. */
  navRecents: (s = 22) => svg(s, '<path d="M6 5v14M12 5v14M18 5v14"/>', 'stroke-width="1.8"'),
  navHome: (s = 22) => svg(s, '<circle cx="12" cy="12" r="7"/>', 'stroke-width="1.8"'),
  navBack: (s = 22) => svg(s, '<path d="M15 5l-7 7 7 7"/>', 'stroke-width="1.8"'),
  signal: (s = 14) => svg(s, '<path d="M4 20h2M9 20v-5M14 20V10M19 20V4"/>', 'stroke-width="2.4"'),
  wifi: (s = 14) => svg(s, '<path d="M2 9a14 14 0 0 1 20 0M5.5 12.5a9 9 0 0 1 13 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>', 'stroke-width="2"'),
  battery: (s = 18) => svg(s, '<rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21 10v4"/><rect x="5.5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>', 'stroke-width="1.6"')

};
