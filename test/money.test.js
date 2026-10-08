import test from 'node:test';
import assert from 'node:assert/strict';
import { formatINR, lineTotal, billTotal, summarise } from '../src/money.js';

test('formatINR groups the last three digits', () => {
  assert.equal(formatINR(280), '₹280');
  assert.equal(formatINR(1320), '₹1,320');
});

test('formatINR uses Indian grouping above one thousand', () => {
  assert.equal(formatINR(24580), '₹24,580');
  assert.equal(formatINR(142300), '₹1,42,300');
  assert.equal(formatINR(10000000), '₹1,00,00,000');
});

test('formatINR rounds to whole rupees', () => {
  assert.equal(formatINR(1319.6), '₹1,320');
  assert.equal(formatINR(0), '₹0');
});

test('formatINR handles negatives', () => {
  assert.equal(formatINR(-1320), '-₹1,320');
});

test('lineTotal multiplies rate by quantity', () => {
  assert.equal(lineTotal({ rate: 28, qty: 10 }), 280);
  assert.equal(lineTotal({ rate: 260, qty: 4 }), 1040);
});

test('billTotal sums every line and rounds to whole rupees', () => {
  assert.equal(billTotal([{ rate: 28, qty: 10 }, { rate: 260, qty: 4 }]), 1320);
  assert.equal(billTotal([]), 0);
});

/* The numbers below are lifted verbatim from the live app's Create Purchase
 * screen (reference/frames/mbb-t84.png). If summarise() reproduces them, the
 * tax model matches the real product. */
test('summarise reproduces the live app Create Purchase screen', () => {
  const s = summarise([{ name: 'Mixed', rate: 24199.81, qty: 1, gst: 18 }]);

  assert.equal(s.subtotal.toFixed(2), '24199.81');
  assert.equal(s.taxable.toFixed(2), '20508.31');
  assert.equal(s.tax.toFixed(2), '3691.50');
  assert.equal(s.cgst.toFixed(2), '1845.75');
  assert.equal(s.sgst.toFixed(2), '1845.75');
  assert.equal(s.roundOff.toFixed(2), '0.19');
  assert.equal(s.total, 24200);
});

test('prices are tax-inclusive, so taxable is below the subtotal', () => {
  const s = summarise([{ name: 'Salt', rate: 118, qty: 1, gst: 18 }]);
  assert.equal(s.subtotal, 118);
  assert.equal(s.taxable.toFixed(2), '100.00');
  assert.equal(s.tax.toFixed(2), '18.00');
});

test('tax splits evenly into CGST and SGST', () => {
  const s = summarise([{ name: 'Salt', rate: 105, qty: 1, gst: 5 }]);
  assert.equal(s.cgst, s.sgst);
  assert.equal((s.cgst + s.sgst).toFixed(2), s.tax.toFixed(2));
});

test('the GST rate is per item, not per bill', () => {
  const s = summarise([
    { name: 'Salt', rate: 105, qty: 1, gst: 5 },
    { name: 'Oil',  rate: 118, qty: 1, gst: 18 }
  ]);
  assert.equal(s.subtotal, 223);
  assert.equal(s.taxable.toFixed(2), '200.00', '100 + 100');
  assert.equal(s.tax.toFixed(2), '23.00', '5 + 18');
});

test('an item with no gst is untaxed', () => {
  const s = summarise([{ name: 'Salt', rate: 100, qty: 1 }]);
  assert.equal(s.tax, 0);
  assert.equal(s.taxable, 100);
  assert.equal(s.total, 100);
});

test('round off can be negative', () => {
  const s = summarise([{ name: 'Thing', rate: 100.4, qty: 1 }]);
  assert.equal(s.total, 100);
  assert.equal(s.roundOff.toFixed(2), '-0.40');
});

test('summarise of nothing is all zeroes', () => {
  const s = summarise([]);
  assert.equal(s.subtotal, 0);
  assert.equal(s.tax, 0);
  assert.equal(s.total, 0);
  assert.equal(s.roundOff, 0);
});
