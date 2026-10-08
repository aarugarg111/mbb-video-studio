import { formatINR } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'invoice-created';

export const targets = {
  share: { x: 310, y: 690 },
  done: { x: 195, y: 790 }
};

/* Laid out from reference/frames/mbb-t24.png: a header, the rendered invoice,
 * then Print / Download / Share, then Done. */
export function render(data, state) {
  const total = state.bill?.total ?? state.total ?? 0;
  const inv = invoiceOf(data);
  const appear = state.appear ?? 1;

  const actions = [['Print', icons.print], ['Download', icons.download], ['Share', icons.share]];

  const line = (item) => `
    <div class="row" style="margin-top: 7px">
      <span class="grow" style="font-size: 11px">${esc(item.name)}</span>
      <span style="font-size: 11px">${item.qty}</span>
      <span style="font-size: 11px; width: 54px; text-align: right">${formatINR(item.rate * item.qty)}</span>
    </div>`;

  return `
<div class="screen" style="background: var(--mbb-pill-grey)">
  <div class="appbar" style="margin-bottom: 16px">
    <span class="ico">${icons.back(24)}</span>
    <div class="titles">
      <h1>Sales Invoice Created</h1>
      <div class="sub">#${esc(inv.number)}</div>
    </div>
    <div class="icons">
      <span class="ico">${icons.edit(24)}</span>
      <span class="ico danger">${icons.trash(24)}</span>
      <span class="ico">${icons.more(24)}</span>
    </div>
  </div>

  <div style="margin: 0 16px; padding: 18px; border: 1px solid var(--mbb-border); border-radius: 10px; background: var(--mbb-surface); opacity: ${appear.toFixed(3)}; transform: scale(${(0.97 + 0.03 * appear).toFixed(3)})">
    <div class="row">
      <span class="grow" style="font-size: 14px; font-weight: 700; letter-spacing: 0.4px">${esc(data?.business?.name)}</span>
      <span class="label" style="font-size: 10px">BILL OF SUPPLY</span>
    </div>
    <div class="label" style="font-size: 10px; margin-top: 8px">Invoice No. ${esc(inv.number)} &nbsp;·&nbsp; ${esc(inv.date)}</div>
    <div style="height: 1px; background: var(--mbb-line); margin: 12px 0"></div>
    <div class="label" style="font-size: 10px">Bill To</div>
    <div style="font-size: 12px; font-weight: 500; margin-top: 3px">${esc(data?.party?.name)}</div>
    <div style="height: 1px; background: var(--mbb-line); margin: 12px 0"></div>
    ${(data?.items ?? []).map(line).join('')}
    <div style="height: 1px; background: var(--mbb-line); margin: 12px 0"></div>
    <div class="row">
      <span class="grow" style="font-size: 12px; font-weight: 700">Total Amount</span>
      <span style="font-size: 15px; font-weight: 700; color: var(--mbb-primary)">${formatINR(total)}</span>
    </div>
  </div>

  <div class="acts">
    ${actions.map(([label, icon]) => `
      <div class="a"><span class="ico">${icon(26)}</span><span class="l">${label}</span></div>`).join('')}
  </div>

  <div style="position: absolute; left: 16px; right: 16px; bottom: 26px">
    <button class="btn">Done</button>
  </div>
</div>`;
}
