import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/recipe.js';

const CATALOGUE = {
  home: ['create-invoice-cta'],
  'create-invoice': ['add-item', 'save-and-share']
};

const GOOD = `
video: demo
business: { name: Agarwal Super Market }
party: { name: Ramesh Kumar }
items:
  - { name: Tata Salt 1kg, rate: 28, qty: 10 }
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 1.0, do: tap, target: create-invoice-cta }
  - screen: create-invoice
    duration: 3.0
    actions:
      - { at: 0.5, do: addItem, index: 0 }
      - { at: 2.0, do: tap, target: save-and-share }
`;

test('a valid recipe parses with no errors', () => {
  const r = parse(GOOD, CATALOGUE);
  assert.ok(!r.errors, 'expected no errors, got: ' + JSON.stringify(r.errors));
  assert.equal(r.recipe.video, 'demo');
  assert.equal(r.recipe.shots.length, 2);
  assert.equal(r.recipe.items[0].rate, 28);
  assert.deepEqual(r.warnings, []);
});

test('malformed YAML is reported, not thrown', () => {
  const r = parse('shots: [unclosed', CATALOGUE);
  assert.ok(r.errors, 'expected errors');
  assert.match(r.errors[0], /YAML/i);
});

test('a missing shots list is an error', () => {
  const r = parse('video: demo', CATALOGUE);
  assert.ok(r.errors.some(e => /shots/.test(e)));
});

test('an unknown screen names the valid screens', () => {
  const r = parse(`
shots:
  - screen: dashborad
    duration: 1.0
`, CATALOGUE);
  assert.ok(r.errors.some(e => /dashborad/.test(e)), 'should quote the bad name');
  assert.ok(r.errors.some(e => /home/.test(e)), 'should list valid screens');
});

test('an unknown tap target names the valid targets', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 0.5, do: tap, target: nope }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /nope/.test(e)));
  assert.ok(r.errors.some(e => /create-invoice-cta/.test(e)));
});

test('an unknown action verb is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 0.5, do: levitate }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /levitate/.test(e)));
});

test('an action past the end of its shot is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 5.0, do: tap, target: create-invoice-cta }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /5/.test(e) && /2/.test(e)));
});

test('a non-positive duration is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 0
`, CATALOGUE);
  assert.ok(r.errors.some(e => /duration/.test(e)));
});

test('addItem beyond the item list warns but still parses', () => {
  const r = parse(`
items:
  - { name: Salt, rate: 10, qty: 1 }
shots:
  - screen: create-invoice
    duration: 2.0
    actions:
      - { at: 0.5, do: addItem, index: 7 }
`, CATALOGUE);
  assert.ok(!r.errors, 'should not be fatal');
  assert.ok(r.warnings.some(w => /7/.test(w)));
});

test('a very short shot warns but still parses', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 0.2
`, CATALOGUE);
  assert.ok(!r.errors);
  assert.ok(r.warnings.some(w => /short/i.test(w)));
});

test('a video over sixty seconds warns', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 61
`, CATALOGUE);
  assert.ok(!r.errors);
  assert.ok(r.warnings.some(w => /60/.test(w)));
});

test('missing optional sections default to empty', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 1.0
`, CATALOGUE);
  assert.deepEqual(r.recipe.items, []);
  assert.equal(r.recipe.business.name, '');
  assert.equal(r.recipe.party.name, '');
});
