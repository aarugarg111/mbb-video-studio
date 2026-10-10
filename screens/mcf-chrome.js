import { icons } from '../src/icons.js';

/* The parts every myCashFlo screen carries: the wallet pill in the header, the
 * support pill floating over the content, and the bottom bar. Written once
 * because four screens show them and a bottom bar that differs between screens
 * reads, on video, as the app glitching.
 */

export const TABS = [
  ['dashboard', 'Dashboard', 'mcfDashboard'],
  ['parties', 'Parties', 'mcfParties'],
  ['automations', 'Automations', 'mcfAutomations'],
  ['settings', 'Settings', 'settings']
];

/* The round navy button sits in the middle of the bar, between the second and
 * third tab, raised above it. */
export function MCF_NAV(active) {
  const tab = ([key, label, icon]) =>
    `<div class="${key === active ? 'on' : ''}" id="nav-${key}">
       <span class="ico">${icons[icon](20)}</span>${label}
     </div>`;

  return `
  <div class="mcf-nav">
    ${TABS.slice(0, 2).map(tab).join('')}
    <div class="mcf-fab"><span class="ico">${icons.dots(18)}</span></div>
    ${TABS.slice(2).map(tab).join('')}
  </div>`;
}

export function walletPill(balance, format) {
  return `
  <div class="mcf-wallet">
    <span class="mcf-dot"></span>
    <span class="ico">${icons.wallet(15)}</span>
    <span class="mcf-wallet-amt">${format(balance)}</span>
  </div>`;
}

export function supportPill() {
  return `
  <div class="mcf-support">
    <span class="ico">${icons.whatsapp(16)}</span>Chat for Support
  </div>`;
}
