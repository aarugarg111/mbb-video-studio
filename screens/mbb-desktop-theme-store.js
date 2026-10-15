import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { invoiceOf } from '../src/invoice.js';
import { FESTIVE_THEMES } from '../src/themes.js';
import { billMarkup } from './invoice-created.js';
import { sidebar } from './mbb-desktop-chrome.js';
import { themeThumb } from './theme-store.js';

export const name = 'mbb-desktop-theme-store';

/* The Theme Store on a laptop.
 *
 * The laptop invoice has carried an "Explore Now" strip advertising the new
 * theme designs since it was built, and tapping it led nowhere: the one screen
 * in the app that is purely about how the bill LOOKS could not be shown on the
 * machine with the big screen.
 *
 * Same flow as the phone's - pick a theme, pick its variant, unlock - in the
 * interface a desk gives you. The phone slides a sheet up over the bill and
 * hides most of it; a laptop has room for both, so the picker sits beside the
 * bill and the bill changes as you choose. That is the one thing this screen
 * is for, and it is the thing the phone cannot quite show.
 *
 * The thumbnails and the theme list are the phone screen's, imported rather
 * than copied, so a theme added to one appears in both.
 *
 * DISCLOSED: no reference frame of this window exists. See
 * screens/mbb-desktop-create-item.js for the same caveat.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/home/settings/themes';

export const focus = { x: 360, y: 203, scale: 1 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'theme-0': { x: 163, y: 114 },
  'theme-1': { x: 280, y: 114 },
  'theme-2': { x: 397, y: 114 },
  'theme-3': { x: 163, y: 179 },
  'theme-4': { x: 280, y: 179 },
  'theme-5': { x: 397, y: 179 },
  'variant-1': { x: 135, y: 226 },
  'variant-2': { x: 199, y: 226 },
  unlock: { x: 280, y: 256 },
  close: { x: 606, y: 57 }
};

/* Choosing a card themes the bill beside it, and the choice outlives the shot
 * so the invoice the clip cuts to afterwards is still wearing it. */
export const tapEffects = {
  ...Object.fromEntries(FESTIVE_THEMES.slice(0, 6).map((t, i) => [`theme-${i}`, { theme: t.slug, variant: 1 }])),
  'variant-1': { variant: 1 },
  'variant-2': { variant: 2 }
};

export const persists = ['theme'];
export const closes = ['close'];

const COLUMNS = 3;

export function render(data, state) {
  const chosen = state?.theme ?? invoiceOf(data).theme;
  const selected = FESTIVE_THEMES.findIndex(t => t.slug === chosen);
  const variant = state?.variant === 2 ? 2 : 1;
  const art = data?.themeArt;

  const card = (t, i) => `
    <div class="dts-card ${i === selected ? 'on' : ''}" id="theme-${i}" data-theme="${t.slug}">
      ${themeThumb(t.slug, art)}
      <div class="dts-nm">${esc(t.name)}</div>
    </div>`;

  /* The row is always here, empty until a theme is chosen. It used to appear
   * with the first choice, which pushed Unlock Themes down the window - so the
   * button was measured in one place and tapped in another, and the ripple
   * would have landed above it. */
  const chips = selected < 0 ? '<div class="dts-chips"></div>' : `
    <div class="dts-chips">
      ${[1, 2].map(n => `
        <div class="dts-chip ${variant === n ? 'on' : ''}" id="variant-${n}">${esc(FESTIVE_THEMES[selected].name)} ${n}</div>`).join('')}
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Sales', 'Sales Invoices')}

  <div class="mb-main">
    <div class="mb-top"><div class="mb-title">Sales Invoice</div></div>
  </div>

  <div class="mb-scrim"></div>
  <div class="dts-win">
    <div class="mb-picker-top">
      <span class="ico">${icons.store(12)}</span>
      <div class="mb-picker-k">Theme Store</div>
      <span class="ico" id="close">${icons.close(10)}</span>
    </div>

    <div class="dts-body">
      <div class="dts-pick">
        <div class="dts-grid">${FESTIVE_THEMES.slice(0, COLUMNS * 2).map(card).join('')}</div>
        ${chips}
        <div class="mb-abtn primary wide" id="unlock">Unlock Themes</div>
      </div>

      <!-- The bill itself, wearing whatever was last chosen. It is the SAME
           markup the phone draws and the camera films elsewhere, so a theme
           cannot look like one thing here and another on the invoice. -->
      <div class="dts-preview">
        <div class="dts-paper">${billMarkup(data ?? {}, { ...state, appear: 1, theme: chosen })}</div>
      </div>
    </div>
  </div>
</div>`;
}
