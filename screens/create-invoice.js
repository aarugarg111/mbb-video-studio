import { formatINR, summarise } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { esc } from '../src/esc.js';

export const name = 'create-invoice';

export const targets = {
  'party-select': { x: 195, y: 150 },
  'item-search': { x: 195, y: 210 },
  'add-item-0': { x: 340, y: 330 },
  'add-item-1': { x: 340, y: 420 },
  'save-and-share': { x: 303, y: 798 }
};

function initials(fullName) {
  return String(fullName || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();
}

export function render(data, state) {
  const partyIn = state.party ?? 0;
  const itemProgress = state.items ?? [];
  const typed = state.typed ?? '';

  const visible = data.items
    .map((item, i) => ({ item, p: itemProgress[i] ?? 0 }))
    .filter(entry => entry.p > 0.001);

  /* The timeline publishes the scaled summary once; reading it here keeps this
   * screen and invoice-created agreeing on every figure. */
  const bill = state.bill ?? summarise([]);

  const partyBlock = partyIn > 0.001
    ? `
      <div class="card row" style="padding: 13px 15px; gap: 11px; opacity: ${partyIn.toFixed(3)}">
        <div class="avatar">${esc(initials(data.party.name))}</div>
        <div class="grow">
          <div style="font-size: 15px; font-weight: 700">${esc(data.party.name)}</div>
          <div class="label" style="margin-top: 2px">${esc(data.party.phone || '')}</div>
        </div>
      </div>`
    : `
      <div class="card row" style="padding: 15px; border-style: dashed; opacity: ${(1 - partyIn).toFixed(3)}">
        <span class="label" style="font-size: 14px">Search or add party</span>
      </div>`;

  /* The live app filters the item list as you type and each row carries either
   * an ADD + button or a - N + stepper once it is on the bill. That stepper is
   * the recognisable part of this screen, so it is what we draw. */
  /* An item already on the bill stays listed even when the search text would
   * filter it out - otherwise a line would vanish from the bill the moment the
   * next search begins. */
  const matching = typed
    ? data.items.filter((it, i) =>
        it.name.toLowerCase().includes(typed.toLowerCase()) ||
        (itemProgress[i] ?? 0) > 0.001)
    : data.items;

  const itemRow = (item, p) => {
    const onBill = p > 0.001;
    const control = onBill
      ? `<div class="stepper" style="opacity: ${p.toFixed(3)}"><span>−</span><span class="qty">${item.qty}</span><span>+</span></div>`
      : `<div class="addbtn">ADD +</div>`;
    return `
      <div class="listrow">
        <div class="grow">
          <div style="font-size: 14px; font-weight: 500">${esc(item.name)}</div>
          <div class="label" style="margin-top: 3px">${formatINR(item.rate)}/${esc(item.unit || 'PCS')}</div>
        </div>
        ${control}
      </div>`;
  };

  const count = visible.length;

  return `
<div class="screen" style="background: var(--mbb-page)">
  <div class="appbar">
    <div class="grow">
      <h1>Create Bill / Invoice</h1>
      <div class="sub">#${esc(invoiceOf(data).number)}</div>
    </div>
  </div>

  <div class="body">
    ${partyBlock}

    <div class="searchbar">
      <span class="label" style="font-size: 16px">⌕</span>
      <span style="font-size: 14px; ${typed ? '' : 'color: var(--mbb-ink-muted)'}">${typed ? esc(typed) : 'Search by item name'}</span>${typed ? '<span class="caret"></span>' : ''}
    </div>

    <div class="card" style="padding: 0; overflow: hidden">
      ${matching.map(item => {
        const i = data.items.indexOf(item);
        return itemRow(item, itemProgress[i] ?? 0);
      }).join('')}
    </div>

    <div class="card">
      <div class="row"><span class="grow label" style="font-size: 13px">Taxable Amount</span><span style="font-size: 13px">${formatINR(bill.taxable)}</span></div>
      <div class="row" style="margin-top: 8px"><span class="grow label" style="font-size: 13px">CGST</span><span style="font-size: 13px">${formatINR(bill.cgst)}</span></div>
      <div class="row" style="margin-top: 8px"><span class="grow label" style="font-size: 13px">SGST</span><span style="font-size: 13px">${formatINR(bill.sgst)}</span></div>
      <div class="row" style="margin-top: 8px"><span class="grow label" style="font-size: 13px">Round Off</span><span style="font-size: 13px">${bill.roundOff.toFixed(2)}</span></div>
      <div class="row" style="margin-top: 10px"><span class="grow" style="font-size: 14px; font-weight: 700">Total Amount</span><span style="font-size: 21px; font-weight: 700; color: var(--mbb-primary)">${formatINR(bill.total)}</span></div>
    </div>
  </div>

  <div class="row" style="position: absolute; left: 0; right: 0; bottom: 0; padding: 13px 15px; background: var(--mbb-surface); border-top: 1px solid var(--mbb-border); gap: 12px">
    <div class="grow">
      <div class="label">${count} ${count === 1 ? 'item' : 'items'}</div>
      <div style="font-size: 19px; font-weight: 700; letter-spacing: -0.4px">${formatINR(bill.total)}</div>
    </div>
    <button class="btn" style="width: auto; height: auto; padding: 14px 19px; font-size: 14px; border-radius: 11px"${count > 0 ? '' : ' disabled'}>Create</button>
  </div>
</div>`;
}
