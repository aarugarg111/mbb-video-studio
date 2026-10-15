import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { rupeesExact } from './mcf-data.js';

/* The frame every myCashFlo laptop page sits in, shared rather than copied.
 *
 * myCashFlo is not a separate site: it is reached from inside myBillBook as
 * "AI Collections", so every page carries TWO rails - myBillBook's down the far
 * left with AI Collections lit, and myCashFlo's own beside it. That was written
 * once inside mcf-desktop.js when there was one laptop page. There are several
 * now, and a second copy of a rail is a rail that drifts: one page would end up
 * with a nav item the others do not have, and nobody would notice until the
 * video showed two different apps.
 *
 * Taken from reference/frames/dmcf-3.png, dmcf-38.png and dmcf-86.png.
 */

/* myBillBook's own rail, trimmed to what fits at this width. AI Collections is
 * the lit one, because that is how these pages are reached. */
const HOST_NAV = [
  ['GENERAL', [
    ['Dashboard', 'mcfDashboard'], ['Parties', 'mcfParties'],
    ['Items', 'navItems'], ['Sales', 'docSettings'], ['Reports', 'ledger']
  ]],
  ['BUSINESS TOOLS', [['AI Collections', 'phone', true]]]
];

/* myCashFlo's own nav, in the order the app lists it. */
export const MCF_NAV = [
  ['Dashboard', 'mcfDashboard'], ['Parties', 'mcfParties'],
  ['History', 'clock'], ['Automations', 'mcfAutomations'], ['Settings', 'settings']
];

/* What the AI is told to do, in the owner's own words - the bar carries
 * exactly this kind of instruction. */
export const ASK = 'Sabse purane overdue parties pe calling start karo';

export function hostRail(business) {
  const item = ([label, icon, lit]) => `
    <div class="dk-hnav ${lit ? 'on' : ''}">
      <span class="ico">${icons[icon](11)}</span>${esc(label)}
      ${lit ? '<span class="dk-new">New</span>' : ''}
    </div>`;

  return `
  <div class="dk-host">
    <div class="dk-host-biz">
      <span class="dk-avatar">${esc(String(business || 'Y').trim().charAt(0).toUpperCase())}</span>
      <span class="dk-host-nm">${esc(business || 'Your Business')}</span>
    </div>
    <div class="dk-host-cta"><span class="ico">${icons.plus(9)}</span>Create Sales Invoice</div>
    ${HOST_NAV.map(([head, items]) => `
      <div class="dk-head-k">${esc(head)}</div>
      ${items.map(item).join('')}`).join('')}
  </div>`;
}

/* `active` is the nav label this page is - "Dashboard", "Parties",
 * "Automations". Anything else lights nothing, which is better than lighting
 * the wrong one. */
export function mcfRail(active, wallet) {
  return `
  <div class="dk-side">
    <div class="dk-brand">myCashFlo</div>
    ${MCF_NAV.map(([label, ic]) => `
      <div class="dk-nav ${label === active ? 'on' : ''}" id="nav-${label.toLowerCase()}">
        <span class="ico">${icons[ic](11)}</span>${esc(label)}
      </div>`).join('')}
    <div class="dk-credits">
      <div class="dk-credits-k">CREDITS</div>
      <div class="dk-credits-v">${rupeesExact(Math.floor(Number(wallet) || 0)).replace('.00', '')}</div>
    </div>
  </div>`;
}

/* The page's own heading, its one button, and the AI bar that is on every page
 * of this app. `button` is {label, id} or null for a page that has none. */
export function topBar(title, button, asking, said = ASK) {
  return `
    <div class="dk-top">
      <div class="dk-title">${esc(title)}</div>
      ${button ? `
        <div class="dk-btn" id="${esc(button.id)}">
          <span class="ico">${icons.plus(10)}</span>${esc(button.label)}
        </div>` : ''}
      <div class="dk-ai ${asking ? 'on' : ''}" id="ask-ai">
        <span class="dk-ai-wave">${icons.dots(11)}</span>
        <div class="dk-ai-txt">
          <div class="dk-ai-ttl">Talk to AI Accountant</div>
          <div class="dk-ai-said">&#8220;${esc(said)}&#8221;</div>
        </div>
        <span class="dk-ai-mic">${icons.mic(12)}</span>
      </div>
    </div>`;
}
