import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { summarise } from '../src/money.js';
import { stateAt } from '../src/timeline.js';

const DATA = {
  business: { name: 'Agarwal Super Market', gstin: '09ABCDE1234F1Z5' },
  party: { name: 'Ramesh Kumar', phone: '98765 43210' },
  items: [{ name: 'Tata Salt 1kg', rate: 28, qty: 10 }]
};

test('the registry exposes the home screen', () => {
  assert.ok(SCREENS.home, 'home should be registered');
  assert.equal(typeof SCREENS.home.render, 'function');
});

test('home renders the business name from the recipe', () => {
  const html = SCREENS.home.render(DATA, {});
  assert.match(html, /Agarwal Super Market/);
});

test('home has a create-invoice tap target with coordinates', () => {
  const t = SCREENS.home.targets['create-invoice-cta'];
  assert.ok(t, 'create-invoice-cta should exist');
  assert.ok(t.x > 0 && t.x < 390, 'x should be inside the screen');
  assert.ok(t.y > 0 && t.y < 844, 'y should be inside the screen');
});

test('screens use tokens, never raw hex colours', () => {
  const html = SCREENS.home.render(DATA, {});
  assert.doesNotMatch(html, /#[0-9a-fA-F]{6}/, 'found a hard-coded hex - use var(--mbb-*)');
});

test('catalogue maps every screen to its target names', () => {
  const c = catalogue();
  assert.deepEqual(c.home, ['create-invoice-cta', 'received-payment']);
});

/* These labels are the live app's own wording. If someone "translates" them
 * back to Hinglish the footage stops matching the product. */
test('home uses the app English labels, not Hinglish', () => {
  const html = SCREENS.home.render(DATA, {});
  for (const label of ['To Collect', 'To Pay', 'Stock Value', 'Total Balance',
                       'Reports', 'Transactions', 'Received Payment',
                       '+ Bill / Invoice', 'Dashboard', 'For You']) {
    assert.ok(html.includes(label), `missing the app label "${label}"`);
  }
  for (const wrong of ['Aaj ki sale', 'Nayi Sale Invoice', 'Lene hain', 'jodein']) {
    assert.ok(!html.includes(wrong), `found Hinglish "${wrong}" - the UI is English`);
  }
});

test('home shows a transaction with a paid and an unpaid pill', () => {
  const html = SCREENS.home.render(DATA, {});
  assert.match(html, /ASHOK POLITHIN CENTER/);
  assert.match(html, /Sales Invoice #\d+/);
  assert.match(html, />Paid</);
  assert.match(html, />Unpaid</);
});

test('text from the recipe is escaped, not injected', () => {
  const html = SCREENS.home.render(
    { ...DATA, business: { name: '<script>x</script>' } }, {}
  );
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /&lt;script&gt;/);
});

/* The palette was measured from the real app and lives in kit/tokens.css. The
 * hex test above only scans rendered HTML, so without this one a literal in
 * the stylesheet would slip through - which is exactly what happened. */
test('kit.css holds no colour literals, only tokens', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const here = dirname(fileURLToPath(import.meta.url));
  const css = await readFile(join(here, '..', 'kit', 'kit.css'), 'utf8');

  const literals = css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g) || [];
  assert.deepEqual(literals, [], 'use var(--mbb-*) and add the value to tokens.css');
});

test('stage/ holds no colour literals, only tokens', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const here = dirname(fileURLToPath(import.meta.url));
  for (const file of ['index.html', 'stage.js']) {
    const src = await readFile(join(here, '..', 'stage', file), 'utf8');
    const literals = src.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/g) || [];
    assert.deepEqual(literals, [], 'stage/' + file + ': use a token from kit/tokens.css');
  }
});

test('the stage loads no fonts from the network, and the font files exist', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const here = dirname(fileURLToPath(import.meta.url));
  const html = await readFile(join(here, '..', 'stage', 'index.html'), 'utf8');
  const tokens = await readFile(join(here, '..', 'kit', 'tokens.css'), 'utf8');
  assert.doesNotMatch(html, /https?:\/\//, 'the stage must not depend on the network');
  const files = tokens.match(/fonts\/[a-z0-9-]+\.woff2/g) || [];
  assert.ok(files.length > 0, 'tokens.css should declare @font-face sources');
  for (const f of files) await access(join(here, '..', 'kit', f));
});

test('every token kit.css references is defined in tokens.css', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');

  const here = dirname(fileURLToPath(import.meta.url));
  const kit = await readFile(join(here, '..', 'kit', 'kit.css'), 'utf8');
  const tokens = await readFile(join(here, '..', 'kit', 'tokens.css'), 'utf8');

  const defined = new Set((tokens.match(/--mbb-[a-z0-9-]+(?=\s*:)/g) || []));
  const used = new Set((kit.match(/var\(\s*(--mbb-[a-z0-9-]+)/g) || [])
    .map(m => m.replace(/var\(\s*/, '')));

  const missing = [...used].filter(t => !defined.has(t));
  assert.deepEqual(missing, [], 'a typo here fails silently as an unstyled element');
});

/* What stateAt hands the screens: item progress plus the scaled bill summary. */
function billState(progress) {
  const bill = summarise(TWO.items.map((it, i) => ({ ...it, qty: it.qty * progress[i] })));
  return { items: progress, bill, total: bill.total };
}

const TWO = { ...DATA, items: [
  { name: 'TATA SALT 1KG', rate: 30, qty: 10, gst: 5 },
  { name: 'SUGAR 5KG', rate: 250, qty: 2, gst: 5 }
]};

test('every item in the catalogue is listed, on the bill or not', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 0]));
  assert.match(html, /TATA SALT 1KG/);
  assert.match(html, /SUGAR 5KG/, 'unselected items still show in the search results');
});

test('an item on the bill gets a stepper, one not on it gets ADD', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 0]));
  assert.match(html, /class="stepper"/, 'the added item should show a stepper');
  assert.match(html, /class="addbtn"/, 'the other should still offer ADD');
});

test('the stepper shows the quantity from the recipe', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 0]));
  assert.match(html, /class="qty">10</);
});

test('typing filters the item list', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [0, 0], typed: 'SUGAR' });
  assert.match(html, /SUGAR 5KG/);
  assert.doesNotMatch(html, /TATA SALT/, 'filtered out by the search text');
});

test('an item already on the bill survives a search that excludes it', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [1, 0], typed: 'SUGAR' });
  assert.match(html, /TATA SALT 1KG/, 'on the bill, so it must stay listed');
  assert.match(html, /SUGAR 5KG/);
});

test('totals land on the real figures once every item has arrived', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 1]));
  /* 30x10 + 250x2 = 800 inclusive of 5% */
  assert.match(html, /₹800/);
});

test('the item count reads correctly and is singular at one', () => {
  assert.match(SCREENS['create-invoice'].render(TWO, billState([1, 0])), /1 item</);
  assert.match(SCREENS['create-invoice'].render(TWO, billState([1, 1])), /2 items</);
});

test('create-invoice disables Generate Bill with an empty bill', () => {
  assert.match(SCREENS['create-invoice'].render(TWO, billState([0, 0])), /disabled/);
});

test('create-invoice enables Generate Bill once an item is on the bill', () => {
  assert.doesNotMatch(SCREENS['create-invoice'].render(TWO, billState([1, 0])), /disabled/);
});

test('create-invoice renders with no state at all', () => {
  const html = SCREENS['create-invoice'].render(DATA, {});
  assert.match(html, /Generate Bill/);
  assert.match(html, /Add more details/);
});

test('invoice-created shows the party and the final total', () => {
  const html = SCREENS['invoice-created'].render(DATA, { total: 280 });
  assert.match(html, /Ramesh Kumar/);
  assert.match(html, /₹280/);
});

/* Two screens are the app working, not the user working: the scan is read
 * and the result confirmed, and the clip moves on by itself. They are named
 * here so that a new screen with no targets still fails this test. */
const PASSIVE = new Set(['scan-reading', 'scan-done']);

test('every registered screen has at least one tap target', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    if (PASSIVE.has(key)) {
      assert.equal(Object.keys(mod.targets).length, 0, `${key} is listed as passive but declares targets`);
      continue;
    }
    assert.ok(Object.keys(mod.targets).length > 0, `${key} has no targets`);
  }
});


test('every registered screen avoids hard-coded hex colours', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    const html = mod.render(DATA, {});
    assert.doesNotMatch(html, /#[0-9a-fA-F]{6}/, `${key} has a hard-coded hex`);
  }
});

test('invoice number and date come from the recipe, not the screens', () => {
  const data = { ...DATA, invoice: { number: 7001, date: '15/11/2026' } };
  const created = SCREENS['invoice-created'].render(data, {});
  assert.match(created, /#7001/);
  assert.match(created, /Invoice No\.<\/b><div>7001/);
  assert.match(created, /15\/11\/2026/);
  assert.match(SCREENS['create-bill'].render(data, {}), /15 Nov 2026/);
  const home = SCREENS.home.render(data, {});
  assert.match(home, /#7000/);
  assert.match(home, /#6999/);
  for (const html of [created, home]) assert.doesNotMatch(html, /594[345]/);
});

test('create-invoice and invoice-created show the same total from stateAt', () => {
  const recipe = {
    business: DATA.business, party: DATA.party, items: TWO.items,
    shots: [
      { screen: 'create-invoice', duration: 3, actions: [
        { do: 'addItem', at: 0, index: 0 }, { do: 'addItem', at: 0.5, index: 1 }] },
      { screen: 'invoice-created', duration: 2, actions: [] }
    ]
  };
  const { screenState } = stateAt(recipe, 4);
  assert.equal(screenState.bill.total, 800);
  assert.match(SCREENS['create-invoice'].render(TWO, screenState), /₹800/);
  assert.match(SCREENS['invoice-created'].render(TWO, screenState), /₹800/);
});

test('screens fall back to a default invoice when the recipe has none', () => {
  const html = SCREENS['invoice-created'].render(DATA, {});
  assert.match(html, /Invoice No\.<\/b><div>\d+/);
  assert.doesNotMatch(html, /undefined|NaN/);
});

/* --- task 10: the billing screens rebuilt from the real app ---------------- */

test('every screen renders with an empty state object', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    assert.equal(typeof mod.render(DATA, {}), 'string', key);
    assert.equal(typeof mod.render({}, {}), 'string', key + ' with empty data');
  }
});

test('create-bill is registered with its three targets', () => {
  assert.deepEqual(catalogue()['create-bill'], ['party-field', 'add-items', 'scan-record']);
});

test('create-invoice has the new targets and no save-and-share', () => {
  assert.deepEqual(catalogue()['create-invoice'],
    ['item-search', 'add-item-0', 'add-item-1', 'generate-bill']);
});

test('create-invoice shows Generate Bill and never Save & Share', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 0]));
  assert.match(html, /Generate Bill/);
  assert.doesNotMatch(html, /Save (&amp;|&) Share/);
});

test('create-invoice has no app bar, party card or totals card', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 1]));
  assert.doesNotMatch(html, /class="appbar"/);
  for (const gone of ['Taxable Amount', 'CGST', 'Search or add party']) {
    assert.ok(!html.includes(gone), `"${gone}" is not on the real item-search screen`);
  }
});

test('an item row has a dashed-underline price and a stock line', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 0]));
  assert.match(html, /class="u">₹ 30\/PCS</);
  assert.match(html, /Stock: 150\.0PCS/);
  assert.match(html, />EDIT</);
});

test('the stepper is three cells, and an item off the bill shows ADD instead', () => {
  const html = SCREENS['create-invoice'].render(TWO, billState([1, 0]));
  assert.equal((html.match(/class="stepper"/g) || []).length, 1);
  assert.equal((html.match(/class="addbtn"/g) || []).length, 1);
  assert.equal((html.match(/class="cell"/g) || []).length, 2, 'minus and plus cells around the qty');
});

test('create-bill shows the placeholder before a party is chosen and the name after', () => {
  const before = SCREENS['create-bill'].render(DATA, { party: 0 });
  assert.match(before, /Search\/Create Party/);
  assert.doesNotMatch(before, /Ramesh Kumar/);
  const after = SCREENS['create-bill'].render(DATA, { party: 1 });
  assert.match(after, /Ramesh Kumar/);
  assert.doesNotMatch(after, /Search\/Create Party/);
});

test('create-bill carries the form copy and an orange Scan & Record', async () => {
  const html = SCREENS['create-bill'].render({ ...DATA, invoice: { number: 1, date: '08/10/2026' } }, {});
  for (const t of ['Create Bill / Invoice', 'Now create Invoices instantly', 'Scan &amp; Record',
                   'Party Name', 'Add Items', '08 Oct 2026']) {
    assert.ok(html.includes(t), `missing "${t}"`);
  }
  assert.match(html, /class="scanbtn/);
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../kit/kit.css', import.meta.url), 'utf8');
  assert.match(css, /\.scanbtn[^}]*var\(--mbb-brand-orange\)/);
});

test('create-bill escapes the party name', () => {
  const html = SCREENS['create-bill'].render({ ...DATA, party: { name: '<b>x</b>' } }, { party: 1 });
  assert.doesNotMatch(html, /<b>x/);
});

test('no screen emits a raw hex or rgb colour, in any state', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    for (const st of [{}, billState([1, 1]), { items: [1, 0], typed: 'S', party: 1 }]) {
      const html = mod.render(TWO, st);
      assert.doesNotMatch(html, /#[0-9a-fA-F]{6}\b|rgba?\(/, `${key} has a raw colour`);
    }
  }
});

test('the app bar is white with dark text - no white-on-purple', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../kit/kit.css', import.meta.url), 'utf8');
  const rule = css.match(/\.appbar \{[^}]*\}/)[0];
  assert.match(rule, /background: var\(--mbb-surface\)/);
  assert.doesNotMatch(css.match(/\.appbar[^{]*\{[^}]*\}/g).join(' '), /on-primary|background: var\(--mbb-primary\)/);
  const html = SCREENS['invoice-created'].render(DATA, {});
  assert.match(html, /class="appbar"/);
});

test('invoice-created shows the header icons and three icon-over-label actions', () => {
  const html = SCREENS['invoice-created'].render(DATA, {});
  assert.match(html, /Sales Invoice Created/);
  assert.match(html, /class="ico danger"/, 'the delete icon is red');
  for (const l of ['Print', 'Download', 'Share']) assert.ok(html.includes('>' + l + '<'), l);
  assert.equal((html.match(/class="a"/g) || []).length, 3);
  assert.doesNotMatch(html, /class="card"/, 'actions are columns, not outlined pills');
});

test('tokens.css no longer carries the unused on-primary tokens', async () => {
  const { readFile } = await import('node:fs/promises');
  const tokens = await readFile(new URL('../kit/tokens.css', import.meta.url), 'utf8');
  assert.doesNotMatch(tokens, /--mbb-on-primary/);
});

/* --- items and create-item ------------------------------------------------ */
const PHARMA = { items: [
  { name: 'PARACETAMOL 500MG', rate: 30, purchase: 26, qty: 1 },
  { name: 'CETIRIZINE 10MG', rate: 25, purchase: 21, qty: 1 }
] };

test('items and create-item render with no data at all', () => {
  assert.equal(typeof SCREENS.items.render({}, {}), 'string');
  assert.equal(typeof SCREENS['create-item'].render({}, {}), 'string');
});

test('items lists every recipe item with its sales and purchase price', () => {
  const html = SCREENS.items.render(PHARMA, {});
  for (const s of ['PARACETAMOL 500MG', 'CETIRIZINE 10MG', '₹ 30', '₹ 26', '₹ 25', '₹ 21',
                   'Sales Price', 'Purchase Price', 'Create New Item', 'Bulk Action', 'Low Stock']) {
    assert.ok(html.includes(s), `missing "${s}"`);
  }
});

test('create-item shows the typed name and escapes it', () => {
  assert.match(SCREENS['create-item'].render({}, { typed: 'Dolo 650' }), /Dolo 650/);
  assert.doesNotMatch(SCREENS['create-item'].render({}, { typed: '<b>x</b>' }), /<b>x<\/b>/);
});

test('create-item selects Batching only when the state says so', () => {
  const off = SCREENS['create-item'].render({}, {});
  const on = SCREENS['create-item'].render({}, { batching: 1 });
  assert.match(off, /class="chip" id="batching"/);
  assert.match(on, /class="chip on" id="batching"/);
});

test('create-item follows state.tab and defaults to Pricing', () => {
  const html = t => SCREENS['create-item'].render({}, t ? { tab: t } : {});
  assert.match(html(), /class="tab on" id="tab-pricing"/);
  assert.match(html('Stock'), /class="tab on" id="tab-stock"/);
  assert.doesNotMatch(html('Stock'), /class="tab on" id="tab-pricing"/);
});

test('a tap on a tab or the Batching pill reaches the screen state', () => {
  const recipe = { items: [], shots: [{ screen: 'create-item', duration: 4, actions: [
    { at: 1, do: 'tap', target: 'tab-stock' }, { at: 2, do: 'tap', target: 'batching' }] }] };
  assert.equal(stateAt(recipe, 0.5).screenState.tab, '');
  assert.equal(stateAt(recipe, 1.5).screenState.tab, 'Stock');
  assert.equal(stateAt(recipe, 1.5).screenState.batching, 0);
  assert.equal(stateAt(recipe, 2.5).screenState.batching, 1);
});

test('the new screens emit no raw hex colour', () => {
  for (const html of [SCREENS.items.render(PHARMA, {}), SCREENS['create-item'].render(PHARMA, { typed: 'a', batching: 1 })]) {
    assert.doesNotMatch(html, /#[0-9a-fA-F]{6}/);
  }
});

test('catalogue includes the new screens and their targets', () => {
  const c = catalogue();
  assert.deepEqual(c.items, ['create-new-item', 'bulk-action', 'item-row-0', 'low-stock']);
  assert.deepEqual(c['create-item'], ['item-name', 'hsn', 'tab-stock', 'batching', 'save']);
});

/* --- WhatsApp share flow ------------------------------------------------- */

const WA = ['share-sheet', 'wa-attach', 'wa-chat'];
const WA_DATA = { invoice: { number: 2301 }, party: { name: 'Meena Sharma' } };

test('the WhatsApp screens render with no data and no state', () => {
  for (const key of WA) {
    const html = SCREENS[key].render({}, {});
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 200, key);
    assert.doesNotThrow(() => SCREENS[key].render(undefined, undefined), key);
  }
});

test('the shared PDF name follows <number>_sales_invoice_<PARTY>.pdf', async () => {
  const { invoiceFileName } = await import('../src/invoice.js');
  assert.equal(invoiceFileName({ invoice: { number: 5946 }, party: { name: 'Anil Distributors' } }),
    '5946_sales_invoice_ANIL_DISTRIBUTORS.pdf');
  assert.match(SCREENS['wa-attach'].render(WA_DATA, {}), /2301_sales_invoice_MEENA_SHARMA\.pdf/);
  assert.match(SCREENS['wa-chat'].render(WA_DATA, {}), /2301_sales_invoice_MEENA_SHARMA\.pdf/);
});

test('the file name escapes odd party names', async () => {
  const { invoiceFileName } = await import('../src/invoice.js');
  assert.equal(invoiceFileName({ party: { name: '<b>A&B  Co</b>' } }), '1001_sales_invoice_B_A_B_CO_B.pdf');
});

test('share-sheet says "1 selected" only when the state says so', () => {
  assert.doesNotMatch(SCREENS['share-sheet'].render(WA_DATA, {}), /1 selected/);
  assert.doesNotMatch(SCREENS['share-sheet'].render(WA_DATA, { selected: 0 }), /1 selected/);
  assert.match(SCREENS['share-sheet'].render(WA_DATA, { selected: 1 }), /1 selected/);
  assert.match(SCREENS['share-sheet'].render(WA_DATA, {}), /Send to\.\.\./);
});

test('a tap on a contact selects it in the share sheet', () => {
  const recipe = { items: [], shots: [{ screen: 'share-sheet', duration: 3, actions: [
    { at: 1, do: 'tap', target: 'contact-0' }] }] };
  assert.equal(stateAt(recipe, 0.5).screenState.selected ?? 0, 0);
  assert.equal(stateAt(recipe, 1.5).screenState.selected, 1);
});

test('wa-chat shows exactly one bubble', () => {
  const html = SCREENS['wa-chat'].render(WA_DATA, {});
  assert.equal((html.match(/class="wa-bubble/g) || []).length, 1);
});

test('wa-attach shows the caption the recipe types', () => {
  assert.match(SCREENS['wa-attach'].render(WA_DATA, {}), /Add a caption\.\.\./);
  const typed = SCREENS['wa-attach'].render(WA_DATA, { typed: 'Bill <3' });
  assert.match(typed, /Bill &lt;3/);
  assert.doesNotMatch(typed, /Add a caption/);
});

test('no WhatsApp screen emits a raw colour, in any state', () => {
  for (const key of WA) {
    for (const st of [{}, { selected: 1 }, { typed: 'x' }]) {
      assert.doesNotMatch(SCREENS[key].render(WA_DATA, st), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, key);
    }
  }
});

test('no WhatsApp screen carries a phone number', () => {
  for (const key of WA) {
    for (const st of [{}, { selected: 1 }]) {
      const html = SCREENS[key].render({ party: { name: 'Rakesh Kumar', phone: '98765 43210' } }, st);
      assert.doesNotMatch(html, /\+91 ?[0-9]/, key);
      assert.doesNotMatch(html, /[0-9]{5} ?[0-9]{5}/, key);
    }
  }
});

test('the WhatsApp screens use the --wa tokens, kept apart from the myBillBook ones', async () => {
  const { readFile } = await import('node:fs/promises');
  const tokens = await readFile(new URL('../kit/tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /ANDROID AND WHATSAPP - NOT myBillBook/);
  assert.match(SCREENS['wa-chat'].render(WA_DATA, {}), /var\(--wa-/);
});

test('catalogue lists the WhatsApp screens and their targets', () => {
  const c = catalogue();
  assert.deepEqual(c['share-sheet'], ['contact-0', 'contact-1', 'send']);
  assert.deepEqual(c['wa-attach'], ['caption', 'send']);
  assert.deepEqual(c['wa-chat'], ['back', 'attachment']);
});
