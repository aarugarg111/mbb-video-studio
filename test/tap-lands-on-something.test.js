/* A tap has to land on something that is still there.
 *
 * Some taps remove the thing they are on: tapping WhatsApp closes the share
 * menu WhatsApp is an item of, tapping Add to Bill closes the item picker it
 * is a button of. The effect used to land on the same frame the ring appeared,
 * so the menu vanished underneath its own ring and the ring went on expanding
 * over whatever was behind it - the invoice. Watching it, the clip pressed
 * Share, opened the menu, and then clicked an empty patch of the bill. The
 * beat the shot exists for - WhatsApp being chosen - was never on screen.
 *
 * Nothing failed. Every target was measured correctly, the ring was drawn at
 * the right coordinates, and the footage was still wrong, which is why this
 * is a test and not a comment.
 *
 * So the screens declare those taps in `dismisses` and src/timeline.js holds
 * the effect back until the ring has finished. This test finds them the only
 * way that cannot go stale: it renders each screen before and after the tap
 * and looks for the id. If a tap's target is in the markup before and gone
 * after, the screen must say so.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCREENS } from '../screens/index.js';
import { stateAt } from '../src/timeline.js';
import { RING_RADIUS, deviceOf } from '../src/device.js';

const DATA = {
  business: { name: 'Agarwal Super Market', gstin: '09ABCDE1234F1Z5' },
  party: { name: 'Ramesh Kumar', phone: '98765 43210' },
  invoice: { number: 5945 },
  items: [
    { name: 'TATA SALT 1KG', rate: 28, qty: 10, purchase: 24, stock: 8 },
    { name: 'SUGAR 5KG', rate: 310, qty: 2, purchase: 272, stock: 4 }
  ]
};

const has = (html, id) => html.includes(`id="${id}"`);

/* The state a screen has to be in for this target to be on it at all.
 *
 * A tap that opens something has usually already happened - you cannot press
 * WhatsApp without having opened the menu, or Add to Bill without having
 * opened the picker - so the search is over what the screen's OWN other taps
 * can put it in. Singly and in pairs, because a target can sit behind two
 * switches.
 *
 * Applying every effect at once instead does not work, and quietly: the item
 * picker has one tap that opens it and three that close it, so all of them
 * together leave it shut and every button inside it invisible. Each one was
 * then skipped as untappable rather than checked. */
function revealingState(screen, target) {
  const others = Object.entries(screen.tapEffects ?? {})
    .filter(([name]) => name !== target)
    .map(([, effect]) => effect);

  const tries = [{}];
  for (const a of others) tries.push({ ...a });
  for (const a of others) for (const b of others) tries.push({ ...a, ...b });

  return tries.find(state => has(screen.render(DATA, state), target)) ?? null;
}

/* Only the "must be declared" direction is checked here, never the reverse.
 * A tap also belongs in `dismisses` when its target is left in the page but
 * COVERED by what the tap opened - the item picker over the button that
 * opens it - and that is invisible from the markup, because the id is still
 * right there. test/ring-lands-on-the-button.e2e.test.js is the one that can
 * see it, because it has real layout to ask. */
test('a tap that removes its own target says so in `dismisses`', () => {
  const missing = [];

  for (const [name, screen] of Object.entries(SCREENS)) {
    const effects = screen.tapEffects ?? {};
    const declared = screen.dismisses ?? [];

    for (const [target, effect] of Object.entries(effects)) {
      /* Only a target that can be on screen can be tapped at all; one that
         never appears is a different problem, and measure-targets.mjs is what
         reports it. */
      const before = revealingState(screen, target);
      if (!before) continue;

      const vanishes = !has(screen.render(DATA, { ...before, ...effect }), target);

      if (vanishes && !declared.includes(target)) missing.push(`${name}: ${target}`);
    }

    for (const target of declared) {
      assert.ok(
        target in effects,
        `${name} lists "${target}" in dismisses but it has no tap effect to hold back`
      );
    }
  }

  assert.deepEqual(
    missing, [],
    'these taps delete the thing they are on, so their ring would land on ' +
    'whatever is behind it. Add each to the screen\'s `dismisses`:\n  ' +
    missing.join('\n  ')
  );
});

test('a dismissed menu outlives its own ring', () => {
  /* The share menu, end to end, at the timings a recipe would use. */
  const recipe = {
    ...DATA,
    shots: [{
      screen: 'mbb-desktop-invoice',
      duration: 6,
      actions: [
        { at: 1.0, do: 'tap', target: 'share' },
        { at: 3.0, do: 'tap', target: 'share-whatsapp' }
      ]
    }]
  };

  const open = t => {
    const frame = stateAt(recipe, t);
    return SCREENS[frame.screen].render(recipe, frame.screenState);
  };

  assert.ok(!has(open(0.5), 'share-whatsapp'), 'the menu is open before Share was pressed');
  assert.ok(has(open(1.2), 'share-whatsapp'), 'pressing Share did not open the menu');

  /* The whole point: through the ring, the option is still there to be seen
     being pressed. */
  for (const t of [3.0, 3.2, 3.4]) {
    assert.ok(has(open(t), 'share-whatsapp'), `the menu closed at ${t}s, under its own ring`);
  }
  assert.ok(!has(open(3.8), 'share-whatsapp'), 'the menu never closed after the ring finished');
});

test('the ring stays inside the button it is on', () => {
  /* A laptop toolbar button is about 26 tall with a few pixels between it and
     the next one. A ring drawn at the phone's radius covered three buttons at
     once, so the footage could not say which had been pressed. */
  assert.ok(
    RING_RADIUS.desktop < RING_RADIUS.phone,
    'a laptop is clicked with a pointer, not pressed with a thumb'
  );

  const screen = SCREENS['mbb-desktop-invoice'];
  assert.equal(deviceOf(screen), 'desktop');

  /* The ring grows to 1.3 of its own size as it fades. Measured neighbours on
     the action bar: Share sits between Print PDF and Generate E-way Bill. */
  const reach = RING_RADIUS.desktop * 1.3;
  const bar = Object.entries(screen.targets)
    .filter(([, p]) => p.y > 80 && p.y < 110)
    .sort((a, b) => a[1].x - b[1].x);
  assert.ok(bar.length > 1, 'the action bar should have more than one button on it');

  for (let i = 1; i < bar.length; i++) {
    const gap = bar[i][1].x - bar[i - 1][1].x;
    assert.ok(
      reach <= gap,
      `the ring on ${bar[i - 1][0]} reaches the middle of ${bar[i][0]} ` +
      `(${reach.toFixed(1)}px of reach, ${gap}px apart) - it cannot say which was pressed`
    );
  }
});

test('both renderers draw the ring at the size they are handed', () => {
  /* It was a bare 42 in three files. Two of them are the two render paths,
     which have to agree frame for frame or the browser and the command line
     produce different videos from one recipe. */
  for (const file of ['../stage/stage.js', '../web/lib/render.ts']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(src, /ripple[\s\S]{0,200}\br\b/, `${file} ignores the ring's radius`);
    assert.doesNotMatch(
      src, /left: \$\{x - 42\}px/,
      `${file} still hard-codes the phone's ring radius`
    );
  }
});
