import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { statusBar, navBar, contactName, initial } from './wa-chrome.js';

export const name = 'share-sheet';

/* The Android share sheet, laid out from reference/frames/wa-19.5.png. This is
 * Android and WhatsApp, not myBillBook: it uses the --wa-* tokens. Coordinates
 * are in 390x844 space, MEASURED from a render. */
export const targets = {
  'contact-0': { x: 195, y: 162 },
  'contact-1': { x: 195, y: 223 },
  send: { x: 349, y: 763 }
};

/* Tapping a contact selects it: the header changes and the send bar appears. */
export const tapEffects = {
  'contact-0': { selected: 1, chosen: 0 },
  'contact-1': { selected: 1, chosen: 1 }
};

/* Invented. The first row is the recipe's own party, so it is the one the
 * flow carries through to the attachment and the chat. */
const OTHERS = [
  ['Suresh Traders', 'Available'],
  ['Meena Sharma', 'Hey there! I am using WhatsApp.'],
  ['Anil Distributors', 'Available'],
  ['Vikram Stores', 'At work'],
  ['Rakesh Kumar', 'Available']
];
const TINTS = ['a', 'b', 'c'];

export function render(data, state) {
  const selected = (state?.selected ?? 0) > 0;
  const chosen = state?.chosen === 1 ? 1 : 0;
  const party = contactName(data);
  const rows = [[party, 'Available'], ...OTHERS.filter(([n]) => n !== party)].slice(0, 7);

  const row = ([nm, sub], i) => `
    <div class="wa-row${selected && i === chosen ? ' on' : ''}" id="contact-${i}">
      <div class="wa-av ${TINTS[i % 3]}">${initial(nm)}${selected && i === chosen ? `<span class="tick">${icons.check(14)}</span>` : ''}</div>
      <div class="tx"><div class="n">${esc(nm)}</div><div class="s">${esc(sub)}</div></div>
    </div>`;

  const picked = rows[chosen][0];

  return `
<div class="screen wa wa-sheet">
  ${statusBar()}
  <div class="wa-head">
    <span class="ico">${icons.back(22)}</span>
    <div class="ttl">${selected ? '1 selected' : 'Send to...'}</div>
    <span class="ico">${icons.personAdd(22)}</span>
    <span class="ico">${icons.search(20)}</span>
  </div>
  <div class="wa-section">Recent chats</div>
  <div class="wa-list">${rows.map(row).join('')}</div>
  ${selected ? `
  <div class="wa-sendbar">
    <div class="chip"><div class="wa-av sm ${TINTS[chosen % 3]}">${initial(picked)}</div>${esc(picked)}</div>
    <div class="wa-fab" id="send">${icons.send(22)}</div>
  </div>` : ''}
  ${navBar()}
</div>`;
}
