import { formatINR } from '../src/money.js';
import { esc } from '../src/esc.js';

export const name = 'home';

/* Coordinates are in 390x844 screen space, measured to the centre of the
 * element the ripple should land on. The CTA is the "+ Bill / Invoice" pill in
 * the floating action row, which sits right of centre. */
export const targets = {
  'create-invoice-cta': { x: 316, y: 746 },
  'received-payment': { x: 90, y: 746 }
};

/* Laid out from reference/frames/mbb-dashboard.png. Labels are the app's own
 * English, not translations - see the plan's Global Constraints. */
export function render(data, state) {
  const nav = ['Dashboard', 'Parties', 'Items', 'For You', 'More'];

  const tile = (fill, title, sub, titleColour) => `
    <div class="tile" style="background: ${fill}">
      <div class="grow">
        <div style="font-size: 16px; font-weight: 700; color: ${titleColour}">${title}</div>
        <div class="label" style="margin-top: 4px">${sub}</div>
      </div>
      <span class="chev">›</span>
    </div>`;

  const txn = (party, docNo, date, amount, paid) => `
    <div class="card" style="padding: 16px; margin-bottom: 11px">
      <div style="font-size: 15px; font-weight: 700">${esc(party)}</div>
      <div class="row" style="margin-top: 10px">
        <span class="grow label" style="font-size: 13px">${docNo}</span>
        <span style="font-size: 14px; font-weight: 700">${amount}</span>
      </div>
      <div class="row" style="margin-top: 6px">
        <span class="grow label" style="font-size: 12px">${date}</span>
        <span class="pill ${paid ? 'paid' : 'unpaid'}">${paid ? 'Paid' : 'Unpaid'}</span>
      </div>
    </div>`;

  return `
<div class="screen" style="background: var(--mbb-page)">
  <div class="row" style="padding: 18px 16px 10px">
    <h1 style="margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -0.3px">${esc(data.business.name)}</h1>
    <span style="margin-left: 8px; color: var(--mbb-primary); font-size: 13px">▾</span>
  </div>

  <div style="margin: 0 16px; padding: 13px 14px; border-radius: 13px; background: var(--mbb-banner)">
    <div style="font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Manage staff with attendance &amp; live field activity</div>
    <div style="margin-top: 8px; display: inline-block; padding: 6px 12px; border-radius: 9px; background: var(--mbb-surface); font-size: 12px; font-weight: 700; color: var(--mbb-ink)">Manage Staff Now →</div>
  </div>

  <div class="tiles">
    ${tile('var(--mbb-tile-green)', formatINR(1494157), 'To Collect ↓', 'var(--mbb-ink)')}
    ${tile('var(--mbb-tile-red)', formatINR(298729), 'To Pay ↑', 'var(--mbb-ink)')}
    ${tile('var(--mbb-tile-blue)', 'Stock Value', 'Value of Items', 'var(--mbb-ink)')}
    ${tile('var(--mbb-tile-blue)', formatINR(5), "This week's sale", 'var(--mbb-ink)')}
    ${tile('var(--mbb-tile-blue)', 'Total Balance', 'Cash + Bank Balance', 'var(--mbb-ink)')}
    ${tile('var(--mbb-tile-blue)', 'Reports', 'Sales, Party, GST…', 'var(--mbb-ink)')}
  </div>

  <div class="row" style="padding: 12px 16px 8px">
    <span class="grow" style="font-size: 15px; font-weight: 500; color: var(--mbb-ink-muted)">Transactions</span>
    <span style="font-size: 13px; font-weight: 700; color: var(--mbb-primary-light)">LAST 365 DAYS</span>
  </div>

  <div style="padding: 0 16px 150px">
    ${txn('Cash Sale', 'Sales Invoice #5944', '08 Oct', formatINR(5), true)}
    ${txn('ASHOK POLITHIN CENTER', 'Sales Invoice #5943', '04 Oct', formatINR(21846), false)}
  </div>

  <div class="fab-row">
    <span class="fab-dark">Received Payment</span>
    <span class="fab-plus">+</span>
    <span class="fab-primary">+ Bill / Invoice</span>
  </div>

  <div class="bottomnav">
    ${nav.map((label, i) => `<div class="${i === 0 ? 'on' : ''}">${label}</div>`).join('')}
  </div>
</div>`;
}
