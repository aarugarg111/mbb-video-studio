import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { formatINR2, summarise } from '../src/money.js';
import { stateAt } from '../src/timeline.js';

/* The app's own worked example: 24,199.81 inclusive at 18%. */
const DATA = {
  business: { name: 'Balaji Trading Co', address: 'Hazratganj, Lucknow' },
  party: { name: 'Suresh Traders', phone: '98765 43210' },
  items: [
    { name: 'CEMENT OPC 50KG', rate: 410.2, qty: 40, gst: 18, unit: 'BAG' },
    { name: 'TMT BAR 8MM', rate: 7791.81, qty: 1, gst: 18, unit: 'BUNDLE' }
  ]
};

const SCAN = ['scan-camera', 'scan-reading', 'scan-done', 'create-purchase'];

test('all four scan screens are registered', () => {
  for (const s of SCAN) assert.ok(SCREENS[s], `${s} should be registered`);
  for (const s of SCAN) assert.ok(s in catalogue());
});

test('all four render with no data at all', () => {
  for (const s of SCAN) assert.ok(SCREENS[s].render({}, {}).length > 0, s);
});

test('the camera films the recipe’s own bill, not a drawing of one', () => {
  /* It shares the markup with Sales Invoice Created; a second copy would let
   * the two drift and the video would contradict itself. */
  const html = SCREENS['scan-camera'].render(DATA, {});
  assert.match(html, /class="bill"/);
  assert.match(html, /Suresh Traders/);
  assert.match(html, /CEMENT OPC 50KG/);
});

test('the camera has a shutter and the viewfinder brackets', () => {
  const html = SCREENS['scan-camera'].render(DATA, {});
  assert.match(html, /id="shutter"/);
  assert.match(html, /camguide/);
});

test('the camera drifts over the shot, so it reads as hand-held', () => {
  const a = SCREENS['scan-camera'].render(DATA, { t: 0 });
  const b = SCREENS['scan-camera'].render(DATA, { t: 1.4 });
  assert.notEqual(a, b, 'a still frame looks like a photograph, not a camera');
});

test('the counter climbs with the shot clock', () => {
  const a = SCREENS['scan-reading'].render(DATA, { t: 0 });
  const b = SCREENS['scan-reading'].render(DATA, { t: 2 });
  assert.match(a, /1\.0s/);
  assert.match(b, /3\.0s/);
});

test('the tip changes as the wait goes on', () => {
  const a = SCREENS['scan-reading'].render(DATA, { t: 0 });
  const b = SCREENS['scan-reading'].render(DATA, { t: 3 });
  assert.notEqual(a, b);
  assert.match(b, /Verify GSTIN/);
});

test("the app's caution about AI is kept, not quietly dropped", () => {
  assert.match(SCREENS['scan-reading'].render(DATA, {}), /AI can make mistakes/);
});

test('the confirmation says how long the scan took and what it saved', () => {
  const html = SCREENS['scan-done'].render(DATA, { t: 2 });
  assert.match(html, /Scanned in 10\.3s!/);
  assert.match(html, /saved you/);
});

test('the tick springs in rather than appearing', () => {
  const a = SCREENS['scan-done'].render(DATA, { t: 0 });
  const b = SCREENS['scan-done'].render(DATA, { t: 0.45 });
  assert.match(a, /scale\(0\.6/);
  assert.match(b, /scale\(1\.0/);
});

test('the purchase totals are the app’s own figures', () => {
  const html = SCREENS['create-purchase'].render(DATA, {});
  assert.match(html, /₹20,508\.31/, 'taxable');
  assert.match(html, /₹3,691\.50/, 'tax');
  assert.match(html, /₹1,845\.75/, 'CGST and SGST');
  assert.match(html, /₹24,199\.81/, 'subtotal');
  assert.match(html, /₹24,200/, 'total, rounded');
});

test('the purchase splits the recipe’s own GST rate in half', () => {
  assert.match(SCREENS['create-purchase'].render(DATA, {}), /CGST @9\.0%/);
  const five = { ...DATA, items: [{ name: 'X', rate: 100, qty: 1, gst: 5 }] };
  assert.match(SCREENS['create-purchase'].render(five, {}), /CGST @2\.5%/);
});

test('the purchase cannot disagree with the bill', () => {
  /* Both read summarise(), so there is no second set of arithmetic to drift. */
  const sum = summarise(DATA.items);
  const html = SCREENS['create-purchase'].render(DATA, {});
  assert.ok(html.includes(formatINR2(sum.taxable)), 'the purchase must show summarise’s own taxable figure');
});

test('formatINR2 groups the Indian way and keeps the paise', () => {
  assert.equal(formatINR2(20508.313559322036), '₹20,508.31');
  assert.equal(formatINR2(1845.7482203389827), '₹1,845.75');
  assert.equal(formatINR2(5), '₹5.00');
  assert.equal(formatINR2(-120.5), '-₹120.50');
});

test('the shot clock reaches the screens', () => {
  const recipe = {
    video: 'x', items: [], shots: [{ screen: 'scan-reading', duration: 3, actions: [] }],
    brand: {}, invoice: {}, business: {}, party: {}
  };
  const a = stateAt(recipe, 0).screenState.t;
  const b = stateAt(recipe, 1.5).screenState.t;
  assert.equal(a, 0);
  assert.ok(Math.abs(b - 1.5) < 1e-9, 't should be seconds since the shot began');
});

test('every scan tap target exists in the markup', () => {
  for (const s of SCAN) {
    const html = SCREENS[s].render(DATA, {});
    for (const id of Object.keys(SCREENS[s].targets)) {
      assert.match(html, new RegExp(`id="${id}"`), `${s}: ${id} has coordinates but no element`);
    }
  }
});

test('no scan screen emits a raw hex colour', () => {
  for (const s of SCAN) assert.doesNotMatch(SCREENS[s].render(DATA, {}), /#[0-9a-fA-F]{6}/, s);
});
