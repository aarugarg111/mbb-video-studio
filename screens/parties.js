import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'parties';

/* The Parties list (reference/frames/party-t28.png). Coordinates are in
 * 390x844 space and are MEASURED from a render, never estimated - an earlier
 * guess on another screen was 44px out. Re-measure if the layout changes. */
export const targets = {
  'party-row-0': { x: 195, y: 240 },
  'party-row-1': { x: 195, y: 320 },
  'send-reminder-0': { x: 306, y: 252 },
  'shared-ledgers': { x: 97, y: 743 },
  'create-party': { x: 299, y: 743 },
  'search': { x: 289, y: 28 }
};

const NAV = [
  ['Dashboard', 'navDashboard'], ['Parties', 'navParties'], ['Items', 'navItems'],
  ['For You', 'navForYou'], ['More', 'navMore']
];

/* Rotated through in order, so neighbouring rows never share a tint - which is
 * what the app itself does. */
const TINTS = [
  'var(--mbb-party-avatar-green)',
  'var(--mbb-avatar-pink)',
  'var(--mbb-party-avatar-green)',
  'var(--mbb-party-avatar-beige)',
  'var(--mbb-party-avatar-blue)'
];

/* Stand-ins used only to fill the list below whatever the recipe names. They
 * are invented: the reference recording is of a real shop, and no real party
 * name, number or avatar from it may reach the code. */
const FILLERS = [
  { name: 'Suresh Traders', kind: 'Supplier', balance: 21846 },
  { name: 'Meena Sharma', kind: 'Customer', balance: 258369 },
  { name: 'Anil Distributors', kind: 'Customer', balance: 2548 },
  { name: 'Vikram Stores', kind: 'Supplier', balance: 308405 },
  { name: 'Lata Enterprises', kind: 'Customer', balance: 11200 },
  { name: 'Gupta Agencies', kind: 'Supplier', balance: 47530 }
];

/* Indian grouping by hand. toLocaleString disagrees between Node and Chrome on
 * some builds, and the two render paths have to produce the same pixels. */
function rupees(n) {
  const s = String(Math.round(Math.abs(Number(n) || 0)));
  if (s.length <= 3) return '₹ ' + s;
  const tail = s.slice(-3);
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return '₹ ' + head + ',' + tail;
}

/* The recipe's own party leads the list, so the video shows the customer the
 * script is about rather than a stranger. */
export function partyRows(data) {
  const named = data?.party?.name ?? data?.invoice?.party?.name;
  const first = named
    ? [{ name: named, kind: 'Customer', balance: Number(data?.party?.balance ?? 6259) }]
    : [];
  return [...first, ...FILLERS].slice(0, 7);
}

export function render(data, state) {
  const rows = partyRows(data);

  const row = (p, i) => `
    <div class="pcard" id="party-row-${i}">
      <div class="pav" style="background: ${TINTS[i % TINTS.length]}">${esc(String(p.name || '?').trim().charAt(0).toUpperCase())}</div>
      <div class="pinfo">
        <div class="pnm">${esc(p.name)}</div>
        <div class="pkind">${esc(p.kind)}</div>
      </div>
      <div class="pamt">
        <div class="pbal">${rupees(p.balance)}<span class="pdown">${icons.arrowDown(15)}</span></div>
        <div class="prem" id="send-reminder-${i}">Send Reminder<span class="pwa">${icons.whatsapp(20)}</span></div>
      </div>
    </div>`;

  return `
<div class="screen partyscreen" style="background: var(--mbb-party-ground)">
  <div class="topbar">
    <div class="ttl">Parties</div>
    <span class="ico" id="search">${icons.search(21)}</span>
    <span class="ico">${icons.linkChain(21)}</span>
    <span class="ico">${icons.settings(21)}</span>
  </div>
  <div class="fpills">
    <div class="fp">To Pay</div>
    <div class="fp">To Collect</div>
    <div class="fp">Category ${icons.chevDown(14)}</div>
    <div class="fp">Filter By <span class="ico on">${icons.filter(14)}</span></div>
  </div>

  <div class="ppromo">
    <div class="ppromo-txt">Tired of asking Party&#8217;s Ledger</div>
    <div class="ppromo-btn">View Shared Ledgers &#8250;</div>
    <span class="ppromo-x">${icons.close(16)}</span>
  </div>

  <div class="plist">${rows.map(row).join('')}</div>

  <div class="floatbtns pbtns">
    <div class="fb ledger" id="shared-ledgers"><span class="ico">${icons.ledger(20)}</span>SharedLedgers</div>
    <div class="fb round"><span class="ico">${icons.folderUp(20)}</span></div>
    <div class="fb create" id="create-party"><span class="ico">${icons.plusCircle(20)}</span>Create Party</div>
  </div>

  <div class="tabnav">
    ${NAV.map(([label, ic], i) => `<div class="${i === 1 ? 'on' : ''}"><span class="ico">${icons[ic](22)}</span>${label}</div>`).join('')}
  </div>
</div>`;
}
