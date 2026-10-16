import * as invoiceCreated from './invoice-created.js';
import { FESTIVE_THEMES, themeArtUrl } from '../src/themes.js';
import { invoiceOf } from '../src/invoice.js';
import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'theme-store';

/* The Theme Store sheet over Sales Invoice Created
 * (reference/frames/th-9.0.png, th-4.5.png, th-13.0.png, th-15.0.png).
 * Coordinates are in 390x844 space, MEASURED from a render
 * (getBoundingClientRect) with the sheet fully open. theme-4 and theme-5 are
 * measured with no theme chosen, or one chosen below the second row: choosing
 * a theme in row one opens the variant chips under it and pushes row two down
 * (theme-4 and theme-5 would then sit at y 497). variant-1 and variant-2 are
 * measured with Diwali chosen, so the chips sit under row two. */
export const targets = {
  'theme-0': { x: 55, y: 334 },
  'theme-1': { x: 148, y: 334 },
  'theme-2': { x: 242, y: 334 },
  'theme-3': { x: 335, y: 334 },
  'theme-4': { x: 55, y: 451 },
  'theme-5': { x: 148, y: 451 },
  'variant-1': { x: 48, y: 532 },
  'variant-2': { x: 124, y: 532 },
  unlock: { x: 195, y: 796 },
  close: { x: 364, y: 260 }
};

/* Tapping a card chooses that theme, and the bill behind the sheet changes with
 * it. The choice outlives the shot, so the invoice that follows is themed. */
export const tapEffects = {
  ...Object.fromEntries(FESTIVE_THEMES.slice(0, 6).map((t, i) => [`theme-${i}`, { theme: t.slug, variant: 1 }])),
  'variant-1': { variant: 1 },
  'variant-2': { variant: 2 }
};
export const persists = ['theme'];
export const closes = ['close'];

const COLUMNS = 4;

/* data.themeArt, when the renderer supplies it, lists the slugs that have art
 * in kit/themes. Without it every card tries its own and the tint behind shows
 * through wherever the file is missing. */
export function themeThumb(slug, themeArt, variant = 1) {
  const tint = `linear-gradient(var(--mbb-theme-${slug}), var(--mbb-theme-${slug}))`;
  const art = themeArtUrl(slug, variant);
  if (Array.isArray(themeArt)) {
    return themeArt.includes(slug)
      ? `<div class="th art" style="background-image: ${art}"></div>`
      : `<div class="th noart" style="background-image: ${tint}"></div>`;
  }
  return `<div class="th" style="background-image: ${art}, ${tint}"></div>`;
}

export function render(data, state) {
  const chosen = state?.theme ?? invoiceOf(data).theme;
  const selected = FESTIVE_THEMES.findIndex(t => t.slug === chosen);
  const variant = state?.variant === 2 ? 2 : 1;
  const sheet = Math.min(1, Math.max(0, state?.sheet ?? 1));
  const art = data?.themeArt;

  const card = (t, i) => {
    const on = i === selected;
    return `
      <div class="tcard${on ? ' on' : ''}" id="theme-${i}" data-theme="${t.slug}">
        ${themeThumb(t.slug, art)}
        ${on ? `<span class="tbadge">${icons.close(7)}</span>` : ''}
        <div class="tn">${esc(t.name)}</div>
      </div>`;
  };

  const chips = selected < 0 ? '' : `
      <div class="tchips">
        ${[1, 2].map(n => `<div class="tchip${variant === n ? ' on' : ''}" id="variant-${n}">${esc(FESTIVE_THEMES[selected].name)} ${n}</div>`).join('')}
      </div>`;

  const rows = [];
  for (let r = 0; r * COLUMNS < FESTIVE_THEMES.length; r++) {
    const cards = FESTIVE_THEMES.slice(r * COLUMNS, (r + 1) * COLUMNS).map((t, c) => card(t, r * COLUMNS + c)).join('');
    rows.push(`<div class="trow">${cards}</div>`);
    if (selected >= 0 && Math.floor(selected / COLUMNS) === r) rows.push(chips);
  }

  /* The invoice behind is the real Sales Invoice Created screen, at rest and
   * wearing the chosen theme, so the two cannot drift apart. */
  const behind = invoiceCreated.render(data, { ...state, appear: 1, theme: chosen });

  return `
<div class="screen">
  ${behind}
  <div class="tsheet" style="transform: translateY(${((1 - sheet) * 100).toFixed(2)}%)">
    <div class="thandle"></div>
    <div class="thead">
      <span class="ico tstore">${icons.store(24)}</span>
      <span class="ttl">Theme Store</span>
      <span class="ico tinfo">${icons.info(20)}</span>
      <span class="ico tx">${icons.close(24)}</span>
    </div>
    <div class="tgrid">${rows.join('')}</div>
    <button class="tunlock">Unlock Themes</button>
  </div>
</div>`;
}
