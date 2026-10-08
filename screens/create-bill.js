import { invoiceOf } from '../src/invoice.js';
import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'create-bill';

/* The form step (reference/frames/bill-t2.png). Measured from a render. */
export const targets = {
  'party-field': { x: 195, y: 300 },
  'add-items': { x: 344, y: 392 },
  'scan-record': { x: 195, y: 155 }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* "08/10/2026" (dd/mm/yyyy, as the recipe writes it) -> "08 Oct 2026".
 * Anything unparseable is shown as written rather than guessed at. */
function prettyDate(raw) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(raw ?? '').trim());
  if (!m || +m[2] < 1 || +m[2] > 12) return String(raw ?? '');
  return `${m[1].padStart(2, '0')} ${MONTHS[+m[2] - 1]} ${m[3]}`;
}

export function render(data, state) {
  const partyIn = state?.party ?? 0;
  const inv = invoiceOf(data);
  const chosen = partyIn > 0 && data?.party?.name;

  return `
<div class="screen" style="background: var(--mbb-page)">
  <div class="appbar">
    <span class="ico">${icons.back(24)}</span>
    <div class="titles"><h1>Create Bill / Invoice</h1></div>
    <span class="ico">${icons.docSettings(26)}</span>
  </div>

  <div class="promo">
    <div class="t1">Now create Invoices instantly</div>
    <div class="t2">Instantly add Invoices Bills from bill Image or PDF</div>
    <div class="scanbtn" id="scan-record"><span class="ico">${icons.scan(22)}</span>Scan &amp; Record</div>
  </div>

  <div class="formdate">${esc(prettyDate(inv.date))}</div>
  <div class="flabel">Party Name <span class="req">*</span></div>
  <div class="pfield${chosen ? ' set' : ''}" id="party-field">
    <span class="ico">${icons.person(24)}</span>
    <span>${chosen ? esc(data?.party?.name) : 'Search/Create Party'}</span>
  </div>

  <div class="flabel" style="padding-top: 28px">Items</div>
  <div class="itemsstrip"><span id="add-items">Add Items</span></div>
</div>`;
}
