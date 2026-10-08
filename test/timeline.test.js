import test from 'node:test';
import assert from 'node:assert/strict';
import { stateAt, totalDuration, TRANSITION_SECONDS } from '../src/timeline.js';
import { SCREENS } from '../screens/index.js';

const RECIPE = {
  video: 'demo',
  business: { name: 'Agarwal Super Market' },
  party: { name: 'Ramesh Kumar' },
  items: [
    { name: 'Tata Salt 1kg', rate: 28, qty: 10 },      // 280
    { name: 'Aashirvaad Atta 5kg', rate: 260, qty: 4 } // 1040
  ],
  shots: [
    { screen: 'home', duration: 2.0, actions: [
      { at: 1.0, do: 'tap', target: 'create-invoice-cta' }
    ]},
    { screen: 'create-invoice', duration: 4.0, actions: [
      { at: 0.5, do: 'selectParty' },
      { at: 1.0, do: 'addItem', index: 0 },
      { at: 2.0, do: 'addItem', index: 1 },
      { at: 3.0, do: 'tap', target: 'save-and-share' }
    ]},
    { screen: 'invoice-created', duration: 2.0, actions: [] }
  ]
};

test('totalDuration sums the shots', () => {
  assert.equal(totalDuration(RECIPE), 8.0);
});

test('t picks the right shot', () => {
  assert.equal(stateAt(RECIPE, 0).screen, 'home');
  assert.equal(stateAt(RECIPE, 1.9).screen, 'home');
  assert.equal(stateAt(RECIPE, 2.1).screen, 'create-invoice');
  assert.equal(stateAt(RECIPE, 6.5).screen, 'invoice-created');
});

test('t past the end clamps to the last frame', () => {
  const f = stateAt(RECIPE, 99);
  assert.equal(f.screen, 'invoice-created');
});

test('a shot change slides the previous screen out', () => {
  const mid = stateAt(RECIPE, 2.0 + TRANSITION_SECONDS / 2);
  assert.equal(mid.outgoing.screen, 'home');
  assert.ok(mid.outgoing.progress > 0 && mid.outgoing.progress < 1);
});

test('the transition is over once it has elapsed', () => {
  assert.equal(stateAt(RECIPE, 2.0 + TRANSITION_SECONDS + 0.01).outgoing, null);
});

test('the first shot never has an outgoing screen', () => {
  assert.equal(stateAt(RECIPE, 0.01).outgoing, null);
});

test('the party appears only after its action', () => {
  assert.equal(stateAt(RECIPE, 2.4).screenState.party, 0, 'before selectParty at 2.5');
  assert.ok(stateAt(RECIPE, 3.2).screenState.party > 0.9, 'well after selectParty');
});

test('items appear one at a time', () => {
  const afterFirst = stateAt(RECIPE, 3.6).screenState.items;
  assert.ok(afterFirst[0] > 0.9, 'first item has landed');
  assert.equal(afterFirst[1], 0, 'second item has not');

  const afterBoth = stateAt(RECIPE, 4.8).screenState.items;
  assert.ok(afterBoth[0] > 0.9 && afterBoth[1] > 0.9);
});

test('the total counts up and settles on the real bill total', () => {
  assert.equal(stateAt(RECIPE, 2.9).screenState.total, 0, 'no items yet');
  assert.equal(Math.round(stateAt(RECIPE, 3.6).screenState.total), 280, 'first item only');
  assert.equal(Math.round(stateAt(RECIPE, 5.5).screenState.total), 1320, 'both items');
});

test('the total is mid-way while an item is landing', () => {
  const mid = stateAt(RECIPE, 3.05).screenState.total;
  assert.ok(mid > 0 && mid < 280, `expected a partial total, got ${mid}`);
});

/* The coordinates come from the screen that owns the target. Asserting them as
 * literals here duplicates the screen's layout in a second place, and when the
 * dashboard was rebuilt that stale copy silently pulled the real screen back to
 * the old position. Read them from the registry instead. */
test('a tap produces a ripple at the target coordinates', () => {
  const f = stateAt(RECIPE, 1.2);
  const target = SCREENS.home.targets['create-invoice-cta'];

  assert.ok(f.ripple, 'expected a ripple shortly after the tap');
  assert.equal(f.ripple.x, target.x);
  assert.equal(f.ripple.y, target.y);
  assert.ok(f.ripple.progress > 0 && f.ripple.progress < 1);
});

test('the ripple follows the named target, not a fixed point', () => {
  const recipe = {
    ...RECIPE,
    shots: [{ screen: 'home', duration: 2.0, actions: [
      { at: 1.0, do: 'tap', target: 'received-payment' }
    ]}]
  };
  const f = stateAt(recipe, 1.2);
  const target = SCREENS.home.targets['received-payment'];

  assert.equal(f.ripple.x, target.x);
  assert.equal(f.ripple.y, target.y);
  assert.notEqual(f.ripple.x, SCREENS.home.targets['create-invoice-cta'].x);
});

test('there is no ripple before or long after a tap', () => {
  assert.equal(stateAt(RECIPE, 0.5).ripple, null);
  assert.equal(stateAt(RECIPE, 1.95).ripple, null);
});

test('stateAt is pure - the same t gives the same frame', () => {
  assert.deepEqual(stateAt(RECIPE, 3.33), stateAt(RECIPE, 3.33));
});

test('typing reveals the text progressively', () => {
  const typingRecipe = {
    ...RECIPE,
    shots: [{ screen: 'create-invoice', duration: 3.0, actions: [
      { at: 0.0, do: 'type', target: 'add-item', text: 'Tata Salt', duration: 1.0 }
    ]}]
  };
  assert.equal(stateAt(typingRecipe, 0).screenState.typed, '');
  const half = stateAt(typingRecipe, 0.5).screenState.typed;
  assert.ok(half.length > 0 && half.length < 9, `expected partial text, got "${half}"`);
  assert.equal(stateAt(typingRecipe, 1.2).screenState.typed, 'Tata Salt');
});
