import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefingFor, shapeOfARecipe } from './briefing';
import { SYSTEM } from './claude';
import { SCREENS, SCREEN_NAMES, RecipeSchema } from './schema';

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
  /* It used to be the JSON Schema itself, and it was seven and a half thousand
     characters - most of the briefing. The API call enforces the schema on its
     own; this goes to somebody pasting into another chat window, where an
     outline says the same thing in a page.

     Generated either way, which is the part that matters: a field added to the
     recipe appears here without anybody remembering to write it down. */
  const shape = shapeOfARecipe();
  for (const key of Object.keys(RecipeSchema.shape)) {
    if (key === 'unsupported') continue;
    assert.match(shape, new RegExp(`\\b${key}:`), `the shape never mentions ${key}`);
  }
  /* Down a level too, or a nested field could go missing unnoticed. */
  assert.match(shape, /dayTotal:/);
  assert.match(shape, /netProfit:/);
  assert.match(shape, /duration:/);
  assert.ok(shape.length < 2500, `the outline has grown back to ${shape.length} characters`);
});

test('the briefing is small enough to paste into a chat box', () => {
  /* Chat windows have input limits and people paste by hand.

     Two things it used to say are now dealt with. "Trim the screens table" was
     wrong - forty-eight screens are 3,700 characters, about a seventh of this.
     And the JSON Schema beneath the rules was 7,900, which is gone: the shape
     is an outline now, and the API call enforces the schema itself.

     What is left is the rules in claude.ts, and they grow every time the
     studio learns something. So when this fails, tighten the newest ones -
     they are usually written long - before touching the table or this
     number. */
  const briefing = briefingFor(SCRIPT);
  assert.ok(briefing.length < 32000, `the briefing has grown to ${briefing.length} characters`);
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
