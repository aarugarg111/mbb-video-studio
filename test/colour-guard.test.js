import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRawColour, rawColoursIn } from '../src/colour-guard.js';

const flags = hasRawColour;

test('a hard-coded colour is still caught, in every form it takes', () => {
  assert.ok(flags('<div style="color: #fff">x</div>'));
  assert.ok(flags('<div style="background:#4A2FC6">x</div>'));
  assert.ok(flags('<div style="border: 1px solid #E1540C">x</div>'));
  assert.ok(flags('<svg fill="#ff0000"/>'));
  assert.ok(flags('<div style="color: rgba(0,0,0,.4)">x</div>'));
  assert.ok(flags('<div style="color: rgb(1,2,3)">x</div>'));
});

test('an invoice number is not a colour', () => {
  /* #486 sprang this once and #212 sprang it again. Both times the invoice
     was renumbered, which fixed the test and left the trap armed. */
  assert.ok(!flags('<div>Sales Invoice #212</div>'));
  assert.ok(!flags('<div>Sales Invoice #486</div>'));
  assert.ok(!flags('<div>Invoice No. #5945</div>'));
  assert.ok(!flags('<div>#29</div>'));
  assert.ok(!flags('<div>Bill #abc123</div>'));
});

test('a numeric character reference is not a colour either', () => {
  assert.ok(!flags('<div>21 bills&#160;scanned</div>'));
  assert.ok(!flags('<div>Friendly &#183; Daily</div>'));
  assert.ok(!flags('<div>&#8217;</div>'));
});

test('a token is what a screen should be using, and passes', () => {
  assert.ok(!flags('<div style="color: var(--mbb-ink)">x</div>'));
  assert.ok(!flags('<div class="mb-row">x</div>'));
});

test('it names what it found, so the message is actionable', () => {
  const found = rawColoursIn('<a style="color: #fff"></a><b style="background:#000"></b>');
  assert.equal(found.length, 2);
  assert.ok(found.some(f => f.includes('#fff')));
  assert.ok(found.some(f => f.includes('#000')));
  assert.deepEqual(rawColoursIn('<div>Invoice #212</div>'), []);
});
