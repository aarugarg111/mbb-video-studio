import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';

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
  assert.match(html, /Sales Invoice #5943/);
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

const TWO = { ...DATA, items: [
  { name: 'TATA SALT 1KG', rate: 30, qty: 10, gst: 5 },
  { name: 'SUGAR 5KG', rate: 250, qty: 2, gst: 5 }
]};

test('every item in the catalogue is listed, on the bill or not', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [1, 0] });
  assert.match(html, /TATA SALT 1KG/);
  assert.match(html, /SUGAR 5KG/, 'unselected items still show in the search results');
});

test('an item on the bill gets a stepper, one not on it gets ADD', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [1, 0] });
  assert.match(html, /class="stepper"/, 'the added item should show a stepper');
  assert.match(html, /class="addbtn"/, 'the other should still offer ADD');
});

test('the stepper shows the quantity from the recipe', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [1, 0] });
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

test('the totals block shows the full GST breakdown', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [1, 1] });
  for (const label of ['Taxable Amount', 'CGST', 'SGST', 'Round Off', 'Total Amount']) {
    assert.ok(html.includes(label), `missing "${label}"`);
  }
});

test('totals land on the real figures once every item has arrived', () => {
  const html = SCREENS['create-invoice'].render(TWO, { items: [1, 1] });
  /* 30x10 + 250x2 = 800 inclusive of 5% */
  assert.match(html, /₹800/);
});

test('the item count reads correctly and is singular at one', () => {
  assert.match(SCREENS['create-invoice'].render(TWO, { items: [1, 0] }), /1 item</);
  assert.match(SCREENS['create-invoice'].render(TWO, { items: [1, 1] }), /2 items</);
});

test('create-invoice disables Create with an empty bill', () => {
  assert.match(SCREENS['create-invoice'].render(TWO, { items: [0, 0] }), /disabled/);
});

test('create-invoice enables Create once an item is on the bill', () => {
  assert.doesNotMatch(SCREENS['create-invoice'].render(TWO, { items: [1, 0] }), /disabled/);
});

test('create-invoice renders with no state at all', () => {
  const html = SCREENS['create-invoice'].render(DATA, {});
  assert.match(html, /Create Bill \/ Invoice/);
});

test('invoice-created shows the party and the final total', () => {
  const html = SCREENS['invoice-created'].render(DATA, { total: 280 });
  assert.match(html, /Ramesh Kumar/);
  assert.match(html, /₹280/);
});

test('every registered screen has at least one tap target', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    assert.ok(Object.keys(mod.targets).length > 0, `${key} has no targets`);
  }
});

test('every registered screen avoids hard-coded hex colours', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    const html = mod.render(DATA, {});
    assert.doesNotMatch(html, /#[0-9a-fA-F]{6}/, `${key} has a hard-coded hex`);
  }
});
