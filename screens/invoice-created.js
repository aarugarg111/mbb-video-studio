import { formatINR, summarise } from '../src/money.js';
import { amountInWords } from '../src/words.js';
import { invoiceOf } from '../src/invoice.js';
import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { themeArtUrl, themeStrength } from '../src/themes.js';

export const name = 'invoice-created';

export const targets = {
  share: { x: 314, y: 655 },
  done: { x: 195, y: 794 }
};

/* The terms the app prints when the shop has not written its own. */
const DEFAULT_TERMS = [
  'Goods once sold will not be taken back or exchanged',
  'All disputes are subject to local jurisdiction'
];

/* A theme name becomes a class or a file path, so only plain names get through. */
const THEME_NAME = /^[A-Za-z0-9_-]+$/;

function themeLayer(theme, variant, strength) {
  if (!theme || theme === 'none' || !THEME_NAME.test(theme)) return '';
  if (theme === 'warm') return '<div class="bill-theme warm"></div>';
  /* The art sits over a tint of the theme's own colour, so a theme whose
   * picture has not been supplied yet still visibly changes the bill instead
   * of vanishing. themeArtUrl names both variants and both extensions. */
  const tint = 'var(--mbb-theme-' + theme + ', var(--mbb-surface))';
  /* How strongly this one shows, set here rather than in the stylesheet
   * because it differs per festival: the bill has to stay readable over a
   * crowded night scene as well as over a pale wash. */
  const fade = themeStrength(theme, strength).toFixed(3);
  return '<div class="bill-theme" style="opacity: ' + fade + '; background-image: '
    + themeArtUrl(theme, variant) + ', linear-gradient(' + tint + ', ' + tint + ')"></div>';
}

/* One CGST and SGST pair per GST slab on the bill, each with its own share of
 * the tax. A bill of 5% items and 18% items shows both pairs. */
function taxRows(items) {
  const slabs = [...new Set(items.map(i => i.gst ?? 0).filter(g => g > 0))].sort((a, b) => a - b);
  return slabs.map(g => {
    const part = summarise(items.filter(i => (i.gst ?? 0) === g)).tax / 2;
    const half = +(g / 2).toFixed(2);
    return ['CGST', 'SGST']
      .map(k => `<div class="r"><span>${k}@${half}%</span><span>${formatINR(part)}</span></div>`)
      .join('');
  }).join('');
}

/* Laid out from reference/frames/mbb-t24.png: a header, the rendered invoice,
 * then Print / Download / Share, then Done. The bill is drawn larger than the
 * app draws it (a shrunken A4 sheet) so that it reads at video size. */
export function render(data, state) {
  const items = data?.items ?? [];
  const sum = summarise(items);
  const inv = invoiceOf(data);
  const shop = esc(data?.business?.name);
  const party = data?.party ?? {};
  const appear = state?.appear ?? 1;
  const terms = inv.terms ?? DEFAULT_TERMS;
  const received = sum.total;
  const qtyTotal = items.reduce((n, i) => n + (Number(i.qty) || 0), 0);

  const actions = [['Print', icons.print], ['Download', icons.download], ['Share', icons.share]];

  const row = (item, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(item.name)}</td><td>${esc(item.hsn ?? '-')}</td>` +
    `<td>${esc(item.qty)} ${esc(item.unit ?? 'PCS')}</td><td>${formatINR(item.rate)}</td>` +
    `<td>${formatINR(item.rate * item.qty)}</td></tr>`;

  return `
<div class="screen" style="background: var(--mbb-pill-grey)">
  <div class="appbar">
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

  ${billMarkup(data, state)}

  <div class="acts">
    ${actions.map(([label, icon]) => `
      <div class="a"><span class="ico">${icon(26)}</span><span class="l">${label}</span></div>`).join('')}
  </div>

  <div style="position: absolute; left: 16px; right: 16px; bottom: 26px">
    <button class="btn">Done</button>
  </div>
</div>`;
}


/* The bill itself, separate from the screen that frames it. The camera films
 * this while it is being scanned, and the Theme Store draws it behind its
 * sheet; a second copy of this markup would let them drift apart and the
 * video would contradict itself. */
export function billMarkup(data, state) {
  const items = data?.items ?? [];
  const sum = summarise(items);
  const inv = invoiceOf(data);
  const shop = esc(data?.business?.name);
  const party = data?.party ?? {};
  const appear = state?.appear ?? 1;
  const terms = inv.terms ?? DEFAULT_TERMS;
  const received = sum.total;
  /* "plain" is the undecorated bill this studio started with; anything else,
   * including nothing at all, is the decorated template the ads are meant to
   * show. */
  const skin = inv.skin === 'plain' ? '' : ' luxury';
  const qtyTotal = items.reduce((n, i) => n + (Number(i.qty) || 0), 0);
  const row = (item, i) => `<tr><td>${i + 1}</td><td class="nm">${esc(item.name)}</td><td>${esc(item.hsn ?? '-')}</td>` +
    `<td>${esc(item.qty)} ${esc(item.unit ?? 'PCS')}</td><td>${formatINR(item.rate)}</td>` +
    `<td>${formatINR(item.rate * item.qty)}</td></tr>`;

  return `<div class="bill${skin}" style="opacity: ${appear.toFixed(3)}; transform: scale(${(0.97 + 0.03 * appear).toFixed(3)})">
    ${themeLayer(state?.theme ?? inv.theme, state?.variant, inv.themeStrength)}
    <div class="bill-body">
      <div class="bh">
        <div class="shop">${shop}</div>
        <div class="bos">BILL OF SUPPLY<span class="badge">ORIGINAL FOR RECIPIENT</span></div>
      </div>
      ${data?.business?.address ? '<div class="addr">' + esc(data.business.address) + '</div>' : ''}

      <div class="cols two">
        <div><b>Invoice No.</b><div>${esc(inv.number)}</div></div>
        <div><b>Invoice Date</b><div>${esc(inv.date)}</div></div>
      </div>

      <div class="cols two">
        <div><b>Bill To</b><div>${esc(party.name)}</div>${party.phone ? '<div>Mobile ' + esc(party.phone) + '</div>' : ''}</div>
        <div><b>Ship To</b><div>${esc(party.name)}</div>${party.address ? '<div class="sm">' + esc(party.address) + '</div>' : ''}</div>
      </div>

      <table class="tbl">
        <thead><tr><th>No</th><th class="nm">Items</th><th>HSN No.</th><th>Qty.</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${items.map(row).join('')}</tbody>
      </table>

      <div class="sub-row"><span>SUBTOTAL</span><span>${qtyTotal}</span><span>${formatINR(sum.subtotal)}</span></div>

      <div class="cols two tot">
        <div class="terms"><b>Terms &amp; Conditions</b>${terms.map((t, i) => '<div>' + (i + 1) + '. ' + esc(t) + '</div>').join('')}</div>
        <div class="sums">
          ${taxRows(items)}
          <div class="r strong"><span>Total Amount</span><span>${formatINR(sum.total)}</span></div>
          <div class="r"><span>Received Amount</span><span>${formatINR(received)}</span></div>
          <div class="r strong"><span>Balance</span><span>${formatINR(sum.total - received)}</span></div>
        </div>
      </div>

      <div class="words"><b>Total Amount (in words)</b><div>${amountInWords(sum.total)}</div></div>

      <div class="sig"><div class="sigbox"></div><b>Signature</b><div>${shop}</div></div>
    </div>
  </div>`;
}
