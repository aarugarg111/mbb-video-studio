import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawColoursIn } from '../src/colour-guard.js';
import { SCREENS, catalogue } from '../screens/index.js';
import { dayOf, revealed, COUNT_SECONDS } from '../screens/day-sales.js';

const DATA = {
  business: { name: 'JHANVI MOMOS CORNER' },
  items: [{ name: 'VEG MOMOS PLATE', rate: 60, qty: 2, gst: 5, unit: 'PLATE', purchase: 26 }]
};

test('it renders with nothing at all', () => {
  assert.ok(SCREENS['day-sales'].render({}, {}).includes('class="screen dsscreen"'));
});

test('it is in the catalogue and its targets exist', () => {
  const html = SCREENS['day-sales'].render(DATA, { t: 9 });
  for (const id of catalogue()['day-sales']) {
    assert.ok(html.includes(`id="${id}"`), `nothing carries id="${id}"`);
  }
});

test('it emits no raw colour and no entity XML cannot read', () => {
  for (const t of [0, 0.7, 9]) {
    const html = SCREENS['day-sales'].render(DATA, { t });
    assert.deepEqual(rawColoursIn(html), []);
    for (const [, e] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
      assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(e), `&${e};`);
    }
  }
});

test('the total is the sum of the bills listed under it', () => {
  /* The whole point of the screen is a figure the viewer trusts. A total that
     did not match its own list is the one thing that would break it. */
  const day = dayOf(DATA);
  assert.equal(day.total, day.sales.reduce((t, s) => t + s.amount, 0));
  assert.equal(day.total, day.plates * day.rate);
  assert.equal(day.total, 1560);
});

test('the profit is what was actually earned, not the takings', () => {
  const day = dayOf(DATA);
  assert.equal(day.profit, day.plates * (day.rate - day.cost));
  assert.equal(day.profit, 884);
  assert.ok(day.profit < day.total, 'profit can never exceed the takings');
});

test('the stall sells what the recipe sells', () => {
  const chai = dayOf({ items: [{ name: 'CHAI', rate: 15, purchase: 6 }] });
  assert.equal(chai.name, 'CHAI');
  assert.equal(chai.rate, 15);
  assert.ok(SCREENS['day-sales'].render({ items: [{ name: 'CHAI', rate: 15 }] }, { t: 9 }).includes('CHAI'));
});

test('a recipe with no purchase price still shows an honest margin', () => {
  /* No cost means no profit can be known, so a margin is assumed rather than
     a number being invented - and it must still be less than the takings. */
  const day = dayOf({ items: [{ name: 'SAMOSA', rate: 20 }] });
  assert.ok(day.cost > 0 && day.cost < day.rate);
  assert.ok(day.profit > 0 && day.profit < day.total);
});

test('a recipe with no items at all still produces a day', () => {
  const day = dayOf({});
  assert.ok(day.total > 0);
  assert.equal(day.sales.length, 8);
});

test('the figure counts up and then settles', () => {
  const day = dayOf(DATA);
  assert.equal(revealed(day.total, 0), 0, 'it starts at nothing, so the reveal is a reveal');
  assert.ok(revealed(day.total, COUNT_SECONDS / 2) > 0);
  assert.ok(revealed(day.total, COUNT_SECONDS / 2) < day.total);
  assert.equal(revealed(day.total, COUNT_SECONDS), day.total);
  assert.equal(revealed(day.total, 99), day.total, 'and never goes past it');
  assert.equal(revealed(day.total, undefined), 0);
});

test('the counting is a pure function of time, so two renders match', () => {
  assert.equal(revealed(1560, 0.7), revealed(1560, 0.7));
  const a = SCREENS['day-sales'].render(DATA, { t: 0.7 });
  const b = SCREENS['day-sales'].render(DATA, { t: 0.7 });
  assert.equal(a, b);
});

test('the day does not reorder itself overnight', () => {
  /* The times are fixed, not read off a clock: a list that reordered itself
     would make two renders of one recipe different files. */
  const a = dayOf(DATA).sales.map(s => s.at);
  const b = dayOf(DATA).sales.map(s => s.at);
  assert.deepEqual(a, b);
  assert.ok(a.every(Boolean));
});

test('a stall name that would break the markup is escaped', () => {
  const html = SCREENS['day-sales'].render({ items: [{ name: '<script>x</script>', rate: 10 }] }, { t: 1 });
  assert.ok(!html.includes('<script>'));
});
