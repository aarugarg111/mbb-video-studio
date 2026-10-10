import test from 'node:test';
import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import { splitRecipe } from './claude';
import type { Recipe } from './schema';

const base: Recipe = {
  video: 'demo',
  business: { name: 'Shop', gstin: '' },
  party: { name: 'Ravi', phone: '' },
  invoice: { number: 1, date: '2026-01-01', theme: 'none' },
  items: [],
  brand: { endCard: null },
  unsupported: ['sharing the invoice on WhatsApp', 'batch-wise stock records'],
  shots: []
};

test('splitRecipe returns the unsupported list separately', () => {
  const out = splitRecipe(base);
  assert.deepEqual(out.unsupported, base.unsupported);
  assert.equal(typeof out.recipe, 'string');
});

test('the recipe YAML contains no unsupported key', () => {
  const out = splitRecipe(base);
  assert.ok(!('unsupported' in (yaml.load(out.recipe) as object)));
  assert.ok(!out.recipe.includes('unsupported'));
  assert.equal((yaml.load(out.recipe) as { video: string }).video, 'demo');
});

test('an empty unsupported list stays empty', () => {
  assert.deepEqual(splitRecipe({ ...base, unsupported: [] }).unsupported, []);
});
