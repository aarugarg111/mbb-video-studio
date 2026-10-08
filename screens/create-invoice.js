import { formatINR, summarise } from '../src/money.js';
import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';

export const name = 'create-invoice';

/* The item-search screen (reference/frames/bill-t9.png). Coordinates are in
 * 390x844 space, MEASURED from a render (getBoundingClientRect / 1.8) - see
 * .superpowers/sdd/task-10-report.md. Re-measure if the layout changes. */
export const targets = {
  'item-search': { x: 176, y: 37 },
  'add-item-0': { x: 344, y: 160 },
  'add-item-1': { x: 344, y: 267 },
  'generate-bill': { x: 314, y: 781 }
};

const TINTS = ['var(--mbb-avatar-peach)', 'var(--mbb-avatar-pink)', 'var(--mbb-avatar-lilac)'];

export function render(data, state) {
  const itemProgress = state?.items ?? [];
  const typed = state?.typed ?? '';
  const items = data?.items ?? [];

  /* The timeline publishes the scaled summary once; reading it here keeps this
   * screen and invoice-created agreeing on every figure. */
  const bill = state?.bill ?? summarise([]);

  const onBill = i => (itemProgress[i] ?? 0) > 0.001;

  /* The live app filters the item list as you type. An item already on the bill
   * stays listed even when the text would filter it out - otherwise a line would
   * vanish from the bill the moment the next search begins. */
  const matching = items
    .map((item, i) => ({ item, i }))
    .filter(({ item, i }) =>
      !typed || String(item.name).toLowerCase().includes(typed.toLowerCase()) || onBill(i));

  const row = ({ item, i }) => {
    const p = itemProgress[i] ?? 0;
    const unit = esc(item.unit || 'PCS');
    const stock = Number(item.stock ?? 150).toFixed(1);
    const control = onBill(i)
      ? `<div class="editbtn">EDIT</div>
         <div class="stepper" style="opacity: ${Math.max(p, 0.4).toFixed(3)}"><span class="cell">${icons.minus(15)}</span><span class="qty">${esc(item.qty)}</span><span class="cell">${icons.plus(15)}</span></div>`
      : `<div class="addbtn">ADD ${icons.plus(13)}</div>`;
    return `
      <div class="irow">
        <div class="av" style="background: ${TINTS[i % TINTS.length]}">${esc(String(item.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="info">
          <div class="nm">${esc(item.name)}</div>
          <div class="pr"><span class="u">${formatINR(item.rate).replace('₹', '₹ ')}/${unit}</span><span class="ico">${icons.chevDown(15)}</span></div>
          <div class="st">Stock: ${stock}${unit}</div>
        </div>
        <div class="ctl">${control}</div>
      </div>`;
  };

  const count = items.filter((_, i) => onBill(i)).length;

  return `
<div class="screen" style="background: var(--mbb-page)">
  <div class="isearch">
    <span class="ico">${icons.back(24)}</span>
    <div class="field" id="item-search-field">
      <span class="ico muted">${icons.search(20)}</span>
      <span class="grow ${typed ? '' : 'muted'}">${typed ? esc(typed) + '<span class="caret"></span>' : 'Search by item name'}</span>
      <span class="ico muted">${icons.close(18)}</span>
    </div>
    <span class="ico">${icons.scan(26)}</span>
    <span class="ico">${icons.mic(24)}</span>
  </div>

  <div class="pills">
    <div class="p">All Categories ${icons.chevDown(16)}</div>
    <div class="p">${icons.plus(14)} Create New Item</div>
  </div>

  <div class="items">
    ${matching.map(row).join('')}
  </div>

  <div class="sumstrip"><span class="grow">${count} ${count === 1 ? 'item' : 'items'}</span><span>${formatINR(bill.total)}</span></div>
  <div class="genrow">
    <div class="more">
      <div class="a">Add more details</div>
      <div class="b">Additional charges, Round off...</div>
    </div>
    <button class="genbtn${count > 0 ? '' : ' off'}"${count > 0 ? '' : ' disabled'}>Generate Bill</button>
  </div>
</div>`;
}
