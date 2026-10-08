import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { amountInWords } from '../src/words.js';
import { parse } from '../src/recipe.js';

const screen = SCREENS['invoice-created'];
const DATA = {
  invoice: { number: 5945, date: '08/10/2026' },
  business: { name: 'Sagar Superbazaar', address: 'Main Market, Agra' },
  party: { name: 'Ashok Polithin Center', phone: '98765 43210' },
  items: [
    { name: 'Tata Salt 1kg', rate: 30, qty: 10, gst: 5, unit: 'PCS' },
    { name: 'Sugar 5kg', rate: 250, qty: 2, gst: 5, unit: 'PCS' }
  ]
};

test('the bill shows shop, party, every item and the total', () => {
  const html = screen.render(DATA, {});
  for (const s of ['Sagar Superbazaar', 'Ashok Polithin Center', 'Tata Salt 1kg', 'Sugar 5kg',
    '₹800', 'Eight Hundred Rupees', 'BILL OF SUPPLY', 'ORIGINAL FOR RECIPIENT', 'Signature', 'SUBTOTAL', '5945']) {
    assert.ok(html.includes(s), 'missing ' + s);
  }
});

test('tax rows follow the items own GST rate', () => {
  const twelve = { ...DATA, items: [{ name: 'Pen', rate: 112, qty: 1, gst: 12 }] };
  const html = screen.render(twelve, {});
  assert.match(html, /CGST@6%/);
  assert.match(html, /SGST@6%/);
  assert.doesNotMatch(html, /CGST@2\.5%/);
});

test('mixed GST slabs each get their own pair of rows', () => {
  const mixed = { ...DATA, items: [{ name: 'A', rate: 105, qty: 1, gst: 5 }, { name: 'B', rate: 118, qty: 1, gst: 18 }] };
  const html = screen.render(mixed, {});
  assert.match(html, /CGST@2\.5%/);
  assert.match(html, /CGST@9%/);
});

test('recipe text is escaped on the bill', () => {
  const html = screen.render({ ...DATA, party: { name: '<b>x</b>' } }, {});
  assert.ok(!html.includes('<b>x</b>'));
});

test('amount in words, Indian English', () => {
  assert.equal(amountInWords(800), 'Eight Hundred Rupees');
  assert.equal(amountInWords(100), 'One Hundred Rupees');
  assert.equal(amountInWords(1000), 'One Thousand Rupees');
  assert.equal(amountInWords(5), 'Five Rupees');
  assert.equal(amountInWords(1), 'One Rupee');
  assert.equal(amountInWords(0), 'Zero Rupees');
  assert.equal(amountInWords(19), 'Nineteen Rupees');
  assert.equal(amountInWords(24200), 'Twenty Four Thousand Two Hundred Rupees');
  assert.equal(amountInWords(125000), 'One Lakh Twenty Five Thousand Rupees');
  assert.equal(amountInWords(10000000), 'One Crore Rupees');
  assert.equal(amountInWords(12345678), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees');
});

test('no theme, theme none and a known theme all render', () => {
  const plain = screen.render(DATA, {});
  const none = screen.render({ ...DATA, invoice: { ...DATA.invoice, theme: 'none' } }, {});
  const warm = screen.render({ ...DATA, invoice: { ...DATA.invoice, theme: 'warm' } }, {});
  assert.doesNotMatch(plain, /bill-theme/);
  assert.doesNotMatch(none, /bill-theme/);
  assert.match(warm, /bill-theme warm/);
  const art = screen.render({ ...DATA, invoice: { ...DATA.invoice, theme: 'lakshmi' } }, {});
  assert.match(art, /kit\/themes\/lakshmi\.png/);
});

test('a theme name cannot break out of the style attribute', () => {
  const html = screen.render({ ...DATA, invoice: { ...DATA.invoice, theme: 'x);"><script>' } }, {});
  assert.doesNotMatch(html, /<script>/);
});

const RECIPE = (theme) => `video: t
invoice: { number: 1, date: "01/01/2026"${theme === undefined ? '' : ', theme: ' + theme} }
shots:
  - screen: invoice-created
    duration: 2.0
`;

test('an unknown theme warns, falls back to none, and still renders', () => {
  const res = parse(RECIPE('nonesuch'), catalogue());
  assert.ok(res.recipe, 'must not be an error');
  assert.ok(res.warnings.some(w => /nonesuch/.test(w)));
  assert.equal(res.recipe.invoice.theme, 'none');
});

test('known themes parse without a warning; CLI-discovered art is accepted', () => {
  assert.equal(parse(RECIPE('warm'), catalogue()).warnings.length, 0);
  assert.equal(parse(RECIPE('none'), catalogue()).warnings.length, 0);
  assert.equal(parse(RECIPE(undefined), catalogue()).recipe.invoice.theme, undefined);
  const res = parse(RECIPE('lakshmi'), catalogue(), { themes: ['none', 'warm', 'lakshmi'] });
  assert.equal(res.recipe.invoice.theme, 'lakshmi');
});

test('invoice-created renders with {} and no state', () => {
  assert.equal(typeof screen.render({}, {}), 'string');
  assert.equal(typeof screen.render({}), 'string');
});
