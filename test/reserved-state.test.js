import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS } from '../screens/index.js';

/* The timeline sets some state for EVERY screen, whatever it is. A screen that
 * reads one of those names by accident gets a value it never asked for:
 * mcf-desktop used "sheet" for its follow-up modal, and the timeline's own
 * sheet-slide ramped it to 1 on its own, so the modal was open from the first
 * frame of every shot. The tap that was supposed to open it did nothing
 * visible, and nothing failed. */

const RESERVED = ['sheet', 't', 'bill', 'typed'];

test('only the Theme Store reacts to the timeline sheet-slide', () => {
  /* Rendering with sheet set must change nothing anywhere else. */
  const data = { business: { name: 'X' }, party: { name: 'Y', balance: 1 }, items: [] };
  for (const [name, mod] of Object.entries(SCREENS)) {
    if (name === 'theme-store') continue;
    const without = mod.render(data, {});
    const with_ = mod.render(data, { sheet: 1 });
    assert.equal(with_, without, `${name} reacts to "sheet", which the timeline sets by itself`);
  }
});

test('no tap effect writes to a name the timeline already owns', () => {
  for (const [name, mod] of Object.entries(SCREENS)) {
    for (const [target, effect] of Object.entries(mod.tapEffects ?? {})) {
      for (const key of Object.keys(effect)) {
        /* theme-store's own close genuinely drives the slide. */
        if (name === 'theme-store') continue;
        assert.ok(
          !RESERVED.includes(key),
          `${name}: tapping "${target}" writes "${key}", which the timeline sets for every screen`
        );
      }
    }
  }
});
