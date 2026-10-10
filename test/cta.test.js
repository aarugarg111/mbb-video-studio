import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/recipe.js';
import { stateAt, totalDuration } from '../src/timeline.js';

const CATALOGUE = { home: ['create-invoice-cta'], 'create-invoice': ['add-item', 'save-and-share'] };
const GOOD = `
video: demo
business: { name: Agarwal Super Market }
party: { name: Ramesh }
items: [{ name: Rice, qty: 1, price: 100 }]
shots:
  - { screen: home, duration: 2.0 }
`;
const shotsOnly = r => r.shots.reduce((s, x) => s + x.duration, 0);

test('no brand block still closes on the CTA, and the clip includes it', () => {
  const { recipe, errors } = parse(GOOD, CATALOGUE);
  assert.deepEqual(errors ?? [], []);
  assert.ok(Math.abs(totalDuration(recipe) - shotsOnly(recipe) - 1.8) < 1e-9);
  const card = stateAt(recipe, totalDuration(recipe)).endCard;
  assert.equal(card.kind, 'cta');
  assert.equal(card.progress, 1);
  assert.equal(stateAt(recipe, shotsOnly(recipe) - 0.01).endCard, null);
});

test('cta: false has no closing card and a shorter clip', () => {
  const { recipe } = parse(GOOD + '\nbrand:\n  cta: false\n', CATALOGUE);
  assert.equal(totalDuration(recipe), shotsOnly(recipe));
  assert.equal(stateAt(recipe, shotsOnly(recipe) + 1).endCard, null);
});

test('cta duration is honoured', () => {
  const { recipe } = parse(GOOD + '\nbrand:\n  cta: { duration: 3 }\n', CATALOGUE);
  assert.equal(totalDuration(recipe), shotsOnly(recipe) + 3);
});

test('a non-positive cta duration is an error', () => {
  for (const d of ['0', '-1', 'soon']) {
    const { errors } = parse(GOOD + `\nbrand:\n  cta: { duration: ${d} }\n`, CATALOGUE);
    assert.ok(errors.some(e => /cta\.duration/.test(e)), d);
  }
});

test('cta and endCard together warn, and the CTA wins', () => {
  const { recipe, warnings } = parse(GOOD + '\nbrand:\n  endCard: { duration: 5 }\n  cta: { duration: 1 }\n', CATALOGUE);
  assert.ok(warnings.some(w => /both cta and endCard/.test(w)));
  assert.equal(totalDuration(recipe), shotsOnly(recipe) + 1);
  assert.equal(stateAt(recipe, totalDuration(recipe)).endCard.kind, 'cta');
});

test('a missing image warns with the path and falls back to the logo card', () => {
  const { recipe, warnings, errors } = parse(GOOD, CATALOGUE, { ctaImage: false });
  assert.equal(errors, undefined);
  assert.ok(warnings.some(w => w.includes('kit/cta/download-now.png')));
  const card = stateAt(recipe, totalDuration(recipe)).endCard;
  assert.equal(card.kind, 'logo');
  assert.equal(card.tagline, 'India ka No.1 Billing App');
  assert.ok(Math.abs(totalDuration(recipe) - shotsOnly(recipe) - 1.8) < 1e-9);
});

test('cta: false with a missing image does not warn', () => {
  const { warnings } = parse(GOOD + '\nbrand:\n  cta: false\n', CATALOGUE, { ctaImage: false });
  assert.ok(!warnings.some(w => /download-now/.test(w)));
});
