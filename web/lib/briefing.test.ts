import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefingFor, shapeOfARecipe } from './briefing';
import { SYSTEM } from './claude';
import { SCREENS, SCREEN_NAMES } from './schema';

const SCRIPT = 'Bhaiya ne bola, bill banao. [Internal team adds: UI - create-invoice]';

test('the briefing carries the studio own instructions, not a retelling of them', () => {
  /* If this ever fails because someone wrote a second copy of the guidance for
   * the free path, the fix is to delete the copy, not to loosen the test: two
   * sets of instructions drift, and the drift shows up as a shot list naming a
   * screen that no longer exists. */
  assert.ok(briefingFor(SCRIPT).includes(SYSTEM));
});

test('every screen that can be drawn is offered to the other tool', () => {
  const briefing = briefingFor(SCRIPT);
  for (const screen of SCREEN_NAMES) {
    assert.ok(briefing.includes(screen), `${screen} is missing from the briefing`);
  }
});

test('every tap target is named, or the other tool invents one', () => {
  const briefing = briefingFor(SCRIPT);
  for (const [screen, targets] of Object.entries(SCREENS)) {
    for (const target of targets as readonly string[]) {
      assert.ok(briefing.includes(target), `${screen} -> ${target} is missing from the briefing`);
    }
  }
});

test('the script itself is in there', () => {
  assert.ok(briefingFor(SCRIPT).includes(SCRIPT));
});

test('what the person typed into the boxes overrides the script', () => {
  const briefing = briefingFor(SCRIPT, { business: 'SAGAR SUPERBAZAAR', party: 'Meena Sharma', theme: 'diwali' });
  assert.ok(briefing.includes('SAGAR SUPERBAZAAR'));
  assert.ok(briefing.includes('Meena Sharma'));
  assert.ok(briefing.includes('diwali'));
  assert.ok(briefing.includes('WHATEVER THE SCRIPT SAYS'));
});

test('with nothing typed in, no empty override block appears', () => {
  const briefing = briefingFor(SCRIPT);
  assert.ok(!briefing.includes('WHATEVER THE SCRIPT SAYS'));
});

test('it asks for YAML only, since a chat window has no structured output', () => {
  const briefing = briefingFor(SCRIPT);
  assert.ok(briefing.includes('ANSWER WITH YAML ONLY'));
  assert.ok(briefing.includes('no markdown fences'));
});

test('the shape handed over is generated, so it cannot describe a stale recipe', () => {
  const shape = shapeOfARecipe();
  const parsed = JSON.parse(shape);
  assert.equal(typeof parsed, 'object');
  assert.ok(JSON.stringify(parsed).includes('shots'));
});

test('the briefing is small enough to paste into a chat box', () => {
  /* Chat windows have input limits and people paste by hand. If this ever
     grows past a point where it is awkward, the screens table is the part to
     trim, not the instructions. */
  const briefing = briefingFor(SCRIPT);
  assert.ok(briefing.length < 24000, `the briefing has grown to ${briefing.length} characters`);
});

test('the briefing does not ask for a field the renderer throws away', () => {
  /* "unsupported" is how the studio's own API call reports features no screen
   * can show. A YAML shot list has no place for it, so the shape must not ask
   * for it - and because the instructions still mention it, the briefing has
   * to say what to do instead, or the two contradict each other. */
  assert.ok(!shapeOfARecipe().includes('unsupported'));
  const briefing = briefingFor(SCRIPT);
  assert.ok(briefing.includes('# Not shown:'), 'the briefing must redirect it to a comment');
  assert.ok(briefing.includes('YAML has no place for'), 'and say why');
});

test('the shape choice reaches the other AI', () => {
  /* Phone or laptop is a decision the person makes before the shot list
     exists, so the free path has to carry it too - otherwise the toggle works
     for Claude and silently does nothing for ChatGPT. */
  const INSTRUCTION = 'Use the LAPTOP screens (mbb-desktop-*, mcf-desktop)';
  const PHONE_ONLY = 'Use the PHONE screens throughout.';

  assert.ok(briefingFor(SCRIPT, { shape: 'laptop' }).includes(INSTRUCTION));
  assert.ok(briefingFor(SCRIPT, { shape: 'phone' }).includes(PHONE_ONLY));

  /* Left to the script, neither instruction is given. */
  const neither = briefingFor(SCRIPT, {});
  assert.ok(!neither.includes(INSTRUCTION));
  assert.ok(!neither.includes(PHONE_ONLY));
});
