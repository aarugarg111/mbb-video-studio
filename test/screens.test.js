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
