import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, SCREEN_NAMES } from './schema';
import { catalogue } from '../../screens/index.js';

/* The studio and the renderer keep separate lists of what exists: this one
 * constrains what the model may propose, and screens/index.js is what can
 * actually be drawn. When they drift, a built screen simply becomes
 * unreachable - which is what had happened to six of them, silently, with
 * every test passing. */

test('every screen the renderer can draw is one the model may propose', () => {
  const drawable = Object.keys(catalogue()).sort();
  const offered = [...SCREEN_NAMES].sort();
  assert.deepEqual(offered, drawable);
});

test('every tap target the studio offers exists on the screen', () => {
  /* catalogue() comes from a .js module, so it arrives untyped. */
  const real = catalogue() as Record<string, string[]>;
  for (const [screen, targets] of Object.entries(SCREENS)) {
    for (const target of targets) {
      assert.ok(
        real[screen].includes(target),
        `schema offers ${screen} -> "${target}", which that screen does not have`
      );
    }
  }
});

test('every tap target a screen has is one the studio offers', () => {
  /* The other direction, which was missing: a target added to a screen and not
     to this list is one the model can never propose, so the beat it was added
     for never reaches a video - the dashboard's "reports" tile sat unreachable
     exactly that way. */
  const real = catalogue() as Record<string, string[]>;
  for (const [screen, targets] of Object.entries(real)) {
    const offered = (SCREENS as Record<string, readonly string[]>)[screen] ?? [];
    for (const target of targets) {
      assert.ok(
        offered.includes(target),
        `${screen} has "${target}", which the schema does not offer the model`
      );
    }
  }
});

test('the names the model is constrained to are the keys of the one map', () => {
  assert.deepEqual([...SCREEN_NAMES], Object.keys(SCREENS));
  assert.ok(SCREEN_NAMES.length > 0, 'an empty enum would reject every shot list');
});
