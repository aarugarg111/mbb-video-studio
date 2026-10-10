import { summarise, formatINR, formatINR2 } from '../src/money.js';
import { icons } from '../src/icons.js';

export const name = 'create-purchase';

/* Measured against a render. */
export const targets = {
  'create-purchase': { x: 195, y: 781 },
  'additional-charges': { x: 195, y: 183 },
  'discount': { x: 195, y: 383 }
};

/* What the scan produced, ready to be saved (reference/frames/scan-t86.png).
 *
 * Every figure comes from summarise(), the same function the bill uses, so the
 * purchase cannot disagree with the invoice the rest of the video shows. The
 * app's own numbers were what summarise was built against: 24199.81 inclusive
 * gives a taxable 20508.31 at 18%, which is the frame exactly. */
const rateOf = items => {
  const rates = items.map(i => Number(i.gst) || 0).filter(Boolean);
  return rates.length ? rates[0] : 18;
};

export function render(data, state) {
  const items = data?.items ?? [];
  const sum = summarise(items);
  const half = (rateOf(items) / 2).toFixed(1);

  const plus = (label, id) => `
    <div class="cprow-add"${id ? ` id="${id}"` : ''}><span class="ico">${icons.plus(17)}</span>${label}</div>`;

  return `
<div class="screen cpscreen">
  <div class="appbar">
    <span class="ico">${icons.back(24)}</span>
    <div class="titles"><h1>Create Purchase</h1></div>
  </div>

  <div class="cpbody">
    <div class="cpcard cprep">
      <span class="cpchip">Replace with Existing Item</span>
      <span class="cpchip edit">EDIT</span>
      <span class="cpchip del">DEL</span>
    </div>

    <div class="cpcard cpline">
      <span>Item Subtotal</span><span class="v">${sum.subtotal.toFixed(2)}</span>
    </div>

    ${plus('Additional Charges', 'additional-charges')}

    <div class="cpcard">
      <div class="cpline"><span>Taxable Amount</span><span class="v">${formatINR2(sum.taxable)}</span></div>
      <div class="cpline">
        <span>Tax Applied <b class="cplink">Hide Breakdown</b></span><span class="v">${formatINR2(sum.tax)}</span>
      </div>
      <div class="cpbreak">
        <div><span>CGST @${half}%</span><span>${formatINR2(sum.cgst)}</span></div>
        <div><span>SGST @${half}%</span><span>${formatINR2(sum.sgst)}</span></div>
      </div>
      <div class="cpline strong"><span>Subtotal</span><span class="v">${formatINR2(sum.subtotal)}</span></div>
    </div>

    ${plus('Discount', 'discount')}

    <div class="cpcard cpround">
      <span class="ico mute">${icons.close(15)}</span>
      <span class="cplbl">Round Off</span>
      <span class="cpstep">${icons.minus(14)}</span>
      <span class="cpstep on">${icons.plus(14)}</span>
      <span class="cpfield">&#8377;<b>${Math.abs(sum.roundOff).toFixed(2)}</b></span>
    </div>

    ${plus('Apply TCS')}
    ${plus('Amount Paid')}
    ${plus('Apply TDS')}
    ${plus('Notes')}
  </div>

  <div class="cptotal"><span>Total Amount</span><span>${formatINR(sum.total)}</span></div>
  <div class="cpfoot">
    <button class="btn" id="create-purchase">Create Purchase</button>
    <div class="cpby">Powered by Mira AI</div>
  </div>
</div>`;
}
