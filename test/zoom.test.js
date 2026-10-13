import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, ACTIONS, ZOOM_RANGE } from '../src/recipe.js';
import { catalogue, SCREENS } from '../screens/index.js';
import { stateAt } from '../src/timeline.js';

const build = actions => {
  const { recipe, errors } = parse([
    'video: z',
    'items: [{ name: VEG MOMOS PLATE, rate: 60, purchase: 26 }]',
    'shots:',
    '  - screen: profit-loss',
    '    duration: 6',
    '    actions:',
    ...actions.map(a => '      - ' + a)
  ].join('\n'), catalogue(), {});
  return { recipe, errors };
};

test('zoom is an action a recipe may use', () => {
  assert.ok(ACTIONS.includes('zoom'));
  assert.ok(ACTIONS.includes('zoomOut'));
});

test('a zoom eases in rather than cutting', () => {
  const { recipe, errors } = build(['{ at: 1.0, do: zoom, target: net-profit, to: 2.4 }']);
  assert.equal(errors, undefined);

  assert.equal(stateAt(recipe, 0.5).zoom, null, 'nothing before its time');
  const mid = stateAt(recipe, 1.2).zoom;
  assert.ok(mid.scale > 1 && mid.scale < 2.4, 'it grows');
  assert.equal(stateAt(recipe, 2.0).zoom.scale, 2.4, 'and settles where it was told');
});

test('a zoom holds until something pulls it back', () => {
  const { recipe } = build(['{ at: 1.0, do: zoom, target: net-profit, to: 2 }']);
  assert.equal(stateAt(recipe, 5.5).zoom.scale, 2, 'it stays in for the rest of the shot');
});

test('zoomOut returns to the whole screen', () => {
  const { recipe } = build([
    '{ at: 1.0, do: zoom, target: net-profit, to: 2.4 }',
    '{ at: 3.0, do: zoomOut }'
  ]);
  assert.ok(stateAt(recipe, 3.2).zoom.scale < 2.4, 'it pulls back');
  assert.equal(stateAt(recipe, 4.0).zoom, null, 'and ends at the whole screen');
});

test('a zoom lands on the point a tap would land on', () => {
  const { recipe } = build(['{ at: 0.2, do: zoom, target: net-profit, to: 2 }']);
  const z = stateAt(recipe, 1.5).zoom;
  const point = SCREENS['profit-loss'].targets['net-profit'];
  assert.equal(z.x, point.x);
  assert.equal(z.y, point.y);
});

test('a zoom to a point the screen does not have is refused, not rendered wrong', () => {
  const { errors } = build(['{ at: 1.0, do: zoom, target: nonsense, to: 2 }']);
  assert.ok(errors, 'the recipe is rejected');
  assert.ok(errors.some(e => e.includes('nonsense')), errors.join('; '));
});

test('a zoom nobody could read, or that does nothing, is refused', () => {
  assert.ok(build([`{ at: 1.0, do: zoom, target: net-profit, to: ${ZOOM_RANGE.max + 2} }`]).errors);
  assert.ok(build([`{ at: 1.0, do: zoom, target: net-profit, to: 1 }`]).errors);
  assert.equal(build([`{ at: 1.0, do: zoom, target: net-profit, to: ${ZOOM_RANGE.min} }`]).errors, undefined);
});

test('a zoom with no "to" still zooms', () => {
  const { recipe, errors } = build(['{ at: 0.2, do: zoom, target: net-profit }']);
  assert.equal(errors, undefined);
  assert.ok(stateAt(recipe, 1.5).zoom.scale > 1);
});

test('the camera is a pure function of time, so two renders match', () => {
  const { recipe } = build(['{ at: 1.0, do: zoom, target: net-profit, to: 2.4 }']);
  assert.deepEqual(stateAt(recipe, 1.3).zoom, stateAt(recipe, 1.3).zoom);
});

test('a shot with no zoom reports none, so nothing moves', () => {
  const { recipe } = parse(
    'video: z\nshots:\n  - { screen: home, duration: 2 }', catalogue(), {});
  assert.equal(stateAt(recipe, 1).zoom, null);
});
