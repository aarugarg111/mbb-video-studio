import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { partyRows } from './parties.js';
import { salesOf } from './sales-list.js';
import { ledger, short } from './mcf-data.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-dashboard';

/* The myBillBook dashboard on a laptop (reference/frames/dmbb-115.png).
 *
 * The same screen as the phone's home, which is the point: a laptop clip is
 * the phone's flow in another interface, not another product. What a wider
 * screen buys is that the things the phone stacks - the figures, the day's
 * transactions, what collections is chasing - are all on it at once.
 *
 * Every figure is worked out from the same places the phone's dashboard uses:
 * the party book the Parties screen lists, and the day the sales list and the
 * Profit and Loss report add up. A recipe may state any of them outright under
 * "dashboard:", exactly as on the phone.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/dashboard';

export const focus = { x: 423, y: 203 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'create-sales-invoice': { x: 63, y: 45 },
  'to-collect': { x: 231, y: 150 },
  'to-pay': { x: 423, y: 150 },
  'transactions': { x: 310, y: 288 },
  'collections': { x: 598, y: 288 }
};

export function render(data, state) {
  const business = data?.business?.name;
  const book = partyRows(data);
  const sum = kind => book.filter(p => p.kind === kind).reduce((t, p) => t + Number(p.balance || 0), 0);
  const day = salesOf(data);
  const said = data?.dashboard ?? {};

  const toCollect = Number(said.toCollect ?? sum('Customer'));
  const toPay = Number(said.toPay ?? sum('Supplier'));
  const weekSale = Number(said.weekSale ?? day.total);
  /* Cash and bank is not a figure any other screen shows, so it is the one
   * thing here the recipe cannot contradict. It is the week's takings plus
   * what is already banked, which at least moves with the clip. */
  const balance = weekSale + 40403;

  const inv = invoiceOf(data ?? {});
  const rows = day.bills.slice(0, 5);
  const late = ledger(data).parties.filter(p => p.overdueDays > 0);
  const atRisk = late.reduce((t, p) => t + p.balance, 0);

  const promo = (title, line, cta, icon) => `
    <div class="dash-promo">
      <div class="dash-promo-txt">
        <div class="dash-promo-k">${esc(title)}</div>
        <div class="dash-promo-s">${esc(line)}</div>
        <div class="dash-promo-a">${esc(cta)} &#8594;</div>
      </div>
      <span class="dash-promo-ico">${icons[icon](20)}</span>
    </div>`;

  const card = (label, value, kind, id) => `
    <div class="dash-fig ${kind}" ${id ? `id="${id}"` : ''}>
      <div class="dash-fig-k">
        ${kind === 'in' ? icons.arrowDown(10) : kind === 'out' ? icons.arrowUp(10) : icons.wallet(10)}
        ${esc(label)}
      </div>
      <div class="dash-fig-v">${formatINR(value)}</div>
    </div>`;

  const txn = b => `
    <div class="dash-row">
      <div class="dash-c date">${esc(b.when)} 2026</div>
      <div class="dash-c type">Sales Invoices</div>
      <div class="dash-c no">${b.no}</div>
      <div class="dash-c party">${esc(b.party)}</div>
      <div class="dash-c amt">${formatINR(b.amount)}</div>
    </div>`;

  const chase = p => `
    <div class="dash-chase">
      <div class="dash-chase-nm">${esc(p.name)}<span class="dash-chase-od">${p.overdueDays}d Overdue</span></div>
      <div class="dash-chase-sub">No Automation active</div>
      <div class="dash-chase-amt">${formatINR(p.balance)}</div>
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(business, 'Dashboard', null)}

  <div class="mb-main dash">
    <div class="mb-top">
      <div class="mb-title">Dashboard</div>
      <div class="mb-actions">
        <span class="mb-icobtn">${icons.store(11)}</span>
        <span class="mb-icobtn">${icons.phone(11)}</span>
        <span class="mb-icobtn">${icons.whatsapp(11)}</span>
        <span class="mb-icobtn">${icons.settings(11)}</span>
      </div>
    </div>

    <div class="dash-promos">
      ${promo('Unable to manage inventory?', 'Scan bills now. Convert them to purchases anytime later.', 'Scan and Record Now', 'scan')}
      ${promo('Manage Staff Smarter', "Track staff attendance, live location, orders and field activity.", 'Manage Staff Now', 'group')}
    </div>

    <div class="dash-overview">
      <span class="dash-overview-k">Business Overview</span>
      <span class="dash-stamp">Last Update: ${esc(String(inv.date))}</span>
    </div>

    <div class="dash-figs">
      ${card('To Collect', toCollect, 'in', 'to-collect')}
      ${card('To Pay', toPay, 'out', 'to-pay')}
      ${card('Total Cash + Bank Balance', balance, 'bank')}
    </div>

    <div class="dash-body">
      <div class="dash-txns" id="transactions">
        <div class="dash-panel-k">Latest Transactions</div>
        <div class="dash-head">
          <div class="dash-c date">DATE</div>
          <div class="dash-c type">TYPE</div>
          <div class="dash-c no">TXN NO</div>
          <div class="dash-c party">PARTY NAME</div>
          <div class="dash-c amt">AMOUNT</div>
        </div>
        ${rows.map(txn).join('')}
        <div class="dash-all">See All Transactions</div>
      </div>

      <div class="dash-mcf" id="collections">
        <div class="dash-mcf-k">
          <span class="ico">${icons.phone(11)}</span>myCashflo &#183; AI Collections
          <span class="mb-new">New</span>
        </div>
        <div class="dash-risk">
          <div>
            <div class="dash-risk-k">AMOUNT AT RISK</div>
            <div class="dash-risk-v">${short(atRisk)}</div>
          </div>
          <div>
            <div class="dash-risk-k">PARTIES AT RISK</div>
            <div class="dash-risk-v">${late.length}</div>
          </div>
        </div>
        <div class="dash-updates-k">Collection updates <em>last 7 days</em></div>
        ${late.slice(0, 2).map(chase).join('')}
        <div class="dash-mcf-cta">Check Collection Updates &#8594;</div>
      </div>
    </div>
  </div>
</div>`;
}
