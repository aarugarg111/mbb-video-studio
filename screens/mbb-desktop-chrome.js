import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR as rupee } from '../src/money.js';

/* The parts every myBillBook desktop screen carries.
 *
 * Rebuilt from reference/frames/dmbb-7.png after the first version was built
 * from a single frame and got the rail badly wrong. The real one is NESTED:
 * the open section shows its children indented under it, and the chosen child
 * is the filled row - on Parties that is "All Parties", with "SharedLedger"
 * and a New tag beneath it. The sections that are closed carry a chevron.
 *
 * It also has three things the first version invented away: the "Scroll for
 * more options" pill, because the list is longer than the window; Settings
 * pinned at the foot; and the "100% Secure / ISO Certified" line under it.
 *
 * The real rail prints the owner's phone number under the business name. It
 * is left out: the recording's is a real number.
 */

/* Each section is [label, icon, children, collapsible]. Children only show for
 * the section the screen is in, which is how the real rail behaves. */
export const NAV = [
  ['GENERAL', [
    ['Dashboard', 'mcfDashboard', []],
    ['Parties', 'mcfParties', ['All Parties', 'SharedLedger']],
    ['Items', 'navItems', ['Inventory', 'Godown (Warehouse)']],
    /* All seven, as the real rail lists them under Sales
     * (reference/frames/dsk-mbb-52.png). Three of them were missing, which is
     * what made the rail look like a sketch of the app rather than the app. */
    ['Sales', 'docSettings', [
      'Sales Invoices', 'Quotation / Estimate', 'Payment In',
      'Sales Return', 'Credit Note', 'Delivery Challan', 'Proforma Invoice'
    ]],
    ['Purchases', 'folderUp', ['Purchase Invoices', 'Payment Out', 'Debit Note']],
    ['Reports', 'ledger', []]
  ]],
  ['ACCOUNTING SOLUTIONS', [
    ['Cash & Bank', 'wallet', []],
    ['E-Invoicing', 'docSettings', []],
    ['Automated Bills', 'sync', []],
    ['Expenses', 'arrowUp', []],
    ['POS Billing', 'store', []]
  ]],
  ['BUSINESS TOOLS', [
    ['AI Collections', 'phone', [], 'New'],
    ['Staff Attendance & Payroll', 'calendar', []]
  ]]
];

/* Each child carries its own icon in the real rail - "All Parties" a people
 * mark, "SharedLedger" a book. An earlier version drew the people mark on
 * whichever child was lit, which put a person beside "Inventory". */
const CHILD_ICON = {
  'All Parties': 'mcfParties',
  SharedLedger: 'ledger',
  Inventory: 'navItems',
  'Godown (Warehouse)': 'store',
  'Sales Invoices': 'docSettings',
  'Quotation / Estimate': 'ledger',
  'Payment In': 'rupeeCircle',
  'Sales Return': 'arrowDown',
  'Credit Note': 'ledger',
  'Delivery Challan': 'folderUp',
  'Proforma Invoice': 'docSettings',
  'Purchase Invoices': 'docSettings',
  'Payment Out': 'rupeeCircle',
  'Debit Note': 'ledger'
};

/* Which child is lit, per screen. */
const CHILD_TAG = { SharedLedger: 'New' };

export function sidebar(business, section, child) {
  const row = ([label, icon, children, tag]) => {
    const open = label === section;
    const hasChildren = children.length > 0;
    return `
      <div class="mb-nav ${open ? 'open' : ''}">
        <span class="ico">${icons[icon](11)}</span>${esc(label)}
        ${tag ? `<span class="mb-new">${esc(tag)}</span>` : ''}
        ${hasChildren ? `<span class="ico mb-chev">${icons.chevDown(9)}</span>` : ''}
      </div>
      ${open && hasChildren ? children.map(c => `
        <div class="mb-sub ${c === child ? 'on' : ''}">
          <span class="ico">${icons[CHILD_ICON[c] || 'ledger'](10)}</span>${esc(c)}
          ${CHILD_TAG[c] ? `<span class="mb-new">${esc(CHILD_TAG[c])}</span>` : ''}
        </div>`).join('') : ''}`;
  };

  return `
  <div class="mb-side">
    <div class="mb-biz">
      <span class="mb-avatar">${esc(String(business || 'B').trim().charAt(0).toUpperCase())}</span>
      <span class="mb-biz-nm">${esc(business || 'Your Business')}</span>
    </div>
    <div class="mb-create" id="create-sales-invoice">
      <span class="ico">${icons.plus(10)}</span>Create Sales Invoice
      <span class="ico mb-chev">${icons.chevDown(9)}</span>
    </div>
    <div class="mb-scroll">
      ${NAV.map(([heading, items]) => `
        <div class="mb-head">${esc(heading)}</div>
        ${items.map(row).join('')}`).join('')}
      <div class="mb-more"><span class="ico">${icons.arrowDown(9)}</span>Scroll for more options</div>
    </div>
    <div class="mb-side-foot">
      <div class="mb-settings"><span class="ico">${icons.settings(11)}</span>Settings</div>
      <div class="mb-trust">
        <span class="ico">${icons.check(9)}</span>100% Secure
        <span class="mb-trust-sep"></span>ISO Certified
      </div>
    </div>
  </div>`;
}

/* The buttons that sit to the right of a screen's title. The real bar ends in
 * a gear and a keyboard-shortcuts button on every screen. */
export function topActions(buttons) {
  return `
  <div class="mb-actions">
    ${buttons.map(b => `
      <div class="mb-abtn ${b.kind ?? ''}" ${b.id ? `id="${b.id}"` : ''}>
        ${b.icon ? `<span class="ico">${icons[b.icon](11)}</span>` : ''}${esc(b.label)}
        ${b.menu ? `<span class="ico mb-chev">${icons.chevDown(9)}</span>` : ''}
      </div>`).join('')}
    <span class="mb-icobtn">${icons.settings(12)}</span>
    <span class="mb-icobtn">${icons.docSettings(12)}</span>
  </div>`;
}

/* The referral strip across the top of the list screens. It is the first thing
 * under the title in the recording, and leaving it out was part of why the
 * first version looked like a wireframe of the real page. */
export function referralStrip() {
  return `
  <div class="mb-promo">
    <span class="mb-promo-ico">${icons.rupeeCircle(14)}</span>
    <div class="mb-promo-txt">
      <div class="mb-promo-ttl">Earn &#8377;501/- for each Referral</div>
      <div class="mb-promo-sub">You gain &#8377;501 per referral, while they enjoy 15% off on any premium plan purchase.</div>
    </div>
    <div class="mb-abtn ghost">Refer Now</div>
    <span class="ico mb-promo-x">${icons.close(11)}</span>
  </div>`;
}

/* The green pill that floats over the bottom-right of every list screen. */
export function pendingActions(count = 2) {
  return `
  <div class="mb-pending">
    <span class="ico">${icons.navItems(12)}</span>Pending Actions
    <span class="mb-pending-n">${count}</span>
  </div>`;
}

/* Mira AI reading a bill into a form. It sits on both Create Sales Invoice and
 * Create Purchase Invoice, which is why it lives here: two copies would drift,
 * and the drift would be two ads describing the same feature differently.
 *
 * The counters are fixed rather than derived - they are the shop's running
 * total, not anything this bill changes, and a number that moved between
 * renders would make two renders of one recipe different files. */
export const SCANNED = 22;
export const HOURS_SAVED = '1.8';

export function miraPanel(filled, beside = false) {
  return `<div class="mb-ai-panel ${beside ? 'beside' : ''}">
      <div class="mb-ai-head">
        <span class="mb-ai-mark">${icons.scan(14)}</span>
        <div>
          <div class="mb-ai-ttl">Autofill this bill</div>
          <div class="mb-ai-sub">Powered by Mira AI</div>
        </div>
      </div>

      <div class="mb-ai-stats">
        <span><b>${SCANNED}</b> bills scanned</span>
        <span>~<b>${HOURS_SAVED} hrs</b> saved</span>
      </div>

      <div class="mb-drop ${filled ? 'done' : ''}" id="upload">
        <span class="ico">${filled ? icons.check(18) : icons.folderUp(18)}</span>
        ${filled ? 'Bill read' : 'Drag &amp; Drop or Upload file'}
        <div class="mb-drop-s">${filled ? 'Fields filled from the bill' : 'PDF, JPG, PNG &#183; max 5MB'}</div>
      </div>

      <div class="mb-proceed" id="proceed">Proceed</div>

      <div class="mb-how">
        <div class="mb-how-k">How it works</div>
        <div class="mb-how-i"><span class="ico">${icons.folderUp(10)}</span>Upload invoice document</div>
        <div class="mb-how-i"><span class="ico">${icons.scan(10)}</span>AI scans &amp; extracts data</div>
        <div class="mb-how-i"><span class="ico">${icons.check(10)}</span>Fields auto-filled instantly</div>
      </div>
    </div>`;
}

/* The "Add Items to Bill" window (reference/frames/dsk-mbb-28.png): the
 * laptop's answer to the phone's item list, and the middle of every billing
 * flow on a laptop. Sales and purchases open the same window - it is the same
 * catalogue - so it is written once here. A second copy would drift, and the
 * drift would be two videos disagreeing about how an item gets onto a bill.
 *
 * It reads the same state the phone's item list does: a per-item 0..1 in
 * state.items, the search text in state.typed.
 */
export function itemPicker({ items, onBill, typed = '', chosen, total, heading = 'Add Items to Bill' }) {
  /* An item already chosen stays listed even when the text would filter it
   * out, or a line would vanish from under the cursor as the next search
   * begins. */
  const matching = items
    .map((item, i) => ({ item, i }))
    .filter(({ item, i }) =>
      !typed || String(item.name).toLowerCase().includes(typed.toLowerCase()) || onBill(i));

  const row = ({ item, i }) => {
    const unit = esc(item.unit || 'PCS');
    return `
      <div class="mb-pick-row">
        <div class="mb-pc nm">${esc(item.name)}</div>
        <div class="mb-pc code">-</div>
        <div class="mb-pc stock">${Number(item.stock ?? 99)} ${unit}</div>
        <div class="mb-pc sale">${rupee(item.rate)}</div>
        <div class="mb-pc buy">${rupee(item.purchase)}</div>
        <div class="mb-pc qty">
          ${onBill(i)
            ? `<span class="mb-step"><span class="mb-step-b">${icons.minus(9)}</span><span class="mb-step-q">${Number(item.qty ?? 1)}</span><span class="mb-step-b">${icons.plus(9)}</span><span class="mb-step-u">${unit}</span></span>`
            : `<span class="mb-add" id="add-item-${i}">+ Add</span>`}
        </div>
      </div>`;
  };

  return `
  <div class="mb-scrim"></div>
  <div class="mb-picker">
    <div class="mb-picker-top">
      <div class="mb-picker-k">${esc(heading)}</div>
      <span class="ico">${icons.close(10)}</span>
    </div>

    <div class="mb-picker-bar">
      <div class="mb-search" id="item-search">
        <span class="ico">${icons.search(10)}</span>
        ${typed ? esc(typed) + '<span class="caret"></span>' : 'Search by Item/ Serial no./ HSN code/ SKU'}
      </div>
      <div class="mb-select">Select Category <span class="ico mb-chev">${icons.chevDown(8)}</span></div>
      <div class="mb-abtn primary">Create New Item</div>
    </div>

    <div class="mb-pick-head">
      <div class="mb-pc nm">Item Name</div>
      <div class="mb-pc code">Item Code</div>
      <div class="mb-pc stock">Stock</div>
      <div class="mb-pc sale">Sales Price</div>
      <div class="mb-pc buy">Purchase Price</div>
      <div class="mb-pc qty">Quantity</div>
    </div>
    <div class="mb-pick-rows">${matching.map(row).join('')}</div>

    <div class="mb-pick-foot">
      <span class="mb-pick-n">Show ${chosen.length} Item(s) Selected</span>
      <span class="mb-pick-sum">${rupee(total)}</span>
      <span class="mb-pick-q">${chosen.reduce((t, i) => t + (Number(i.qty) || 1), 0)}</span>
    </div>

    <div class="mb-pick-acts">
      <span class="mb-keys-k">Keyboard Shortcuts :</span>
      <span>Change Quantity <b>Enter</b></span>
      <div class="mb-abtn ghost">Cancel [ESC]</div>
      <div class="mb-abtn primary" id="add-to-bill">Add to Bill [F7]</div>
    </div>
  </div>`;
}
