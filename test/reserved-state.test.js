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

test('no recipe splits a stateful screen across two shots in a row', async () => {
  /* A screen's state starts fresh with every shot. So a sheet opened by a tap
     in one shot is shut again by the time the next shot begins, even when both
     shots are the same screen.

     desktop-collections did exactly this: it opened the follow-up sheet at the
     end of one shot and played the whole of step 2 - choosing the parties,
     activating the automation - into the next, where the sheet was closed
     again. Every tap landed on the parties table behind it. Nothing failed,
     and the clip showed an automation being set up that applied to nobody.

     Two shots of one screen are fine when that screen carries no state - the
     parties list has no tapEffects, so nothing can be lost there. */
  const { readdir, readFile } = await import('node:fs/promises');
  const dir = new URL('../recipes/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    const text = await readFile(new URL(file, dir), 'utf8');
    const shots = [...text.matchAll(/^\s*-\s*screen:\s*(\S+)/gm)].map(m => m[1]);
    for (let i = 1; i < shots.length; i++) {
      if (shots[i] !== shots[i - 1]) continue;
      const carries = Object.keys(SCREENS[shots[i]]?.tapEffects ?? {}).length > 0;
      assert.ok(
        !carries,
        `${file} plays ${shots[i]} across two shots in a row, and that screen ` +
        'carries state - whatever the first shot turned on is off again in the second'
      );
    }
  }
});
