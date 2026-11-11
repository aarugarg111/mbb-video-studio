/* The clips are silent on purpose, except for one thing: the myCashFlo AI
 * call, where the AI speaking IS the product. A silent clip of an AI phone
 * call is a clip of a phone.
 *
 * Putting a real voice on one measured two numbers that had only ever been
 * guessed at, and both were wrong in the direction that hurts:
 *
 *   The AI call screen claimed it needed 9 seconds. The last line starts
 *   5.4s in and takes 4.9s to say, so the screen cuts away while the AI is
 *   still talking - the commitment, which is the whole point of the call.
 *
 *   A caption was held for 2.8s because "a spoken Hinglish sentence runs a
 *   little under three seconds". They ran 3.8s and 4.9s, so the words left
 *   the screen before the voice finished saying them.
 *
 * This is the check that found it, kept apart from the synthesising and the
 * muxing so it needs no voice, no ffmpeg and no particular machine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { troublesWith } from '../worker/narrate.js';
import { SCREENS, catalogue, howToValidate } from '../screens/index.js';
import { parse } from '../src/recipe.js';
import { voiceLines } from '../src/voiceover.js';
import { totalDuration } from '../src/timeline.js';

const CATALOGUE = catalogue();
const HOW = howToValidate();

/* The real exchange, with the lengths the synthesiser actually produced. */
const MEASURED = [
  { at: 7.3, length: 3.8, shotEnds: 17.0, shotSeconds: 10.5, text: 'Sir, payment kab tak clear ho jayega?' },
  { at: 11.9, length: 4.9, shotEnds: 17.0, shotSeconds: 10.5, text: 'Theek hai sir, kal afternoon ka commitment note kar liya.' }
];

test('the clip as it now stands has nothing wrong with its voice timing', () => {
  assert.deepEqual(troublesWith(MEASURED, 26.8), []);
});

test('a line still talking after the picture cuts away is reported', () => {
  /* The 9s shot, which is what this looked like before it was measured. */
  const onNineSeconds = MEASURED.map(l => ({ ...l, shotEnds: 15.5, shotSeconds: 9 }));
  const said = troublesWith(onNineSeconds, 25.8);

  assert.equal(said.length, 1, said.join(' / '));
  assert.match(said[0], /past the end of its shot/);
  /* The useful half: how long the shot should have been. 11.9 + 4.9 - 6.5. */
  assert.match(said[0], /at least 10\.3s/);
});

test('it says how much to add, not merely that something is wrong', () => {
  /* A shot ending at 5s that runs 3s began at 2s. A line from 2s lasting 5s
     needs the shot to reach 7s, which is 5s long - so "at least 5.0s". My
     first draft of this test said 6.0 and the code was right. */
  const said = troublesWith(
    [{ at: 2, length: 5, shotEnds: 5, shotSeconds: 3 }], 30
  );
  assert.match(said[0], /at least 5\.0s/);
});

test('two lines that would talk over each other are reported', () => {
  const said = troublesWith(
    [
      { at: 1, length: 4, shotEnds: 20, shotSeconds: 20 },
      { at: 3, length: 2, shotEnds: 20, shotSeconds: 20 }
    ],
    20
  );
  assert.ok(said.some(s => /overlap/.test(s)), said.join(' / '));
});

test('a voice running past the whole clip is its own complaint', () => {
  const said = troublesWith(
    [{ at: 9, length: 4, shotEnds: 99, shotSeconds: 99 }], 10
  );
  assert.ok(said.some(s => /past the end of the clip/.test(s)), said.join(' / '));
});

test('a line that merely lands on the boundary is not nagged about', () => {
  /* Exactly filling its shot is correct, not a fault, and a frame of
     rounding either way must not produce a sentence. */
  assert.deepEqual(troublesWith([{ at: 5, length: 5, shotEnds: 10, shotSeconds: 10 }], 10), []);
  assert.deepEqual(troublesWith([{ at: 5, length: 5.02, shotEnds: 10, shotSeconds: 10 }], 10), []);
});

test('nothing to say about nothing', () => {
  assert.deepEqual(troublesWith([], 10), []);
});

/* The floor and the lines live in the same file, so they can be checked
 * against each other without a voice at all - and this is the arithmetic that
 * was wrong for as long as the number was a guess. */
test('the AI call screen allows long enough for its own last line', () => {
  const screen = SCREENS['mcf-ai-call'];
  const last = screen.TRANSCRIPT[screen.TRANSCRIPT.length - 1];

  /* 4.9s is what the last line measured. A screen whose floor cannot fit its
     own final sentence is a screen that cuts off its payoff. */
  assert.ok(
    screen.needsSeconds >= last.at + 4.9,
    `needsSeconds is ${screen.needsSeconds} but the last line starts at ${last.at}s and ` +
    'takes about 4.9s to say'
  );
});

/* The clips Customer Support sends a customer who is stuck: the same app
 * screens, with a voice saying what to do. The recipe carries the words -
 * `say` on a shot - because a how-to is written by whoever knows the answer,
 * not generated.
 *
 * I built the AI call's dialogue first, which was the convenient thing
 * rather than the thing asked for. These are the lines that matter.
 */
test('a shot can say what to do, and it is spoken', () => {
  const { recipe, errors } = parse(
    'video: help\nshots:\n  - screen: home\n    duration: 5\n' +
    '    say: Create Sales Invoice pe tap karo\n',
    CATALOGUE, HOW
  );
  assert.deepEqual(errors ?? [], []);

  const lines = voiceLines(recipe);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'Create Sales Invoice pe tap karo');
  assert.ok(lines[0].voiced, 'an instruction is useless unheard');
  assert.ok(lines[0].instruction, 'and it is marked as one, not as dialogue');
  /* Not on the cut itself: the first word names the screen, and it must not
     land while the viewer is still taking the screen in. */
  assert.ok(lines[0].at > 0, 'it waits a moment after the cut');
});

test('several lines over one shot are spread, not stacked on the cut', () => {
  const { recipe } = parse(
    'video: help\nshots:\n  - screen: home\n    duration: 9\n' +
    '    say: [First thing, Second thing, Third thing]\n',
    CATALOGUE, HOW
  );
  const at = voiceLines(recipe).map(l => l.at);
  assert.equal(at.length, 3);
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i] > at[i - 1], `line ${i + 1} must come after line ${i}: ${at.join(', ')}`);
  }
});

test('a line placed by hand lands where it was put', () => {
  const { recipe } = parse(
    'video: help\nshots:\n  - screen: home\n    duration: 8\n' +
    '    say:\n      - { at: 3.5, text: Exactly here }\n',
    CATALOGUE, HOW
  );
  assert.equal(voiceLines(recipe)[0].at, 3.5);
});

test('a line that could never be heard is refused, not dropped', () => {
  const { errors } = parse(
    'video: help\nshots:\n  - screen: home\n    duration: 4\n' +
    '    say:\n      - { at: 9, text: Too late }\n',
    CATALOGUE, HOW
  );
  assert.ok((errors ?? []).some(e => /never be heard/.test(e)), (errors ?? []).join(' / '));
});

test('a spoken line with no words is refused', () => {
  for (const bad of ['say: ""', 'say:\n      - { at: 1, text: "" }', 'say: [ "" ]']) {
    const { errors } = parse(
      `video: help\nshots:\n  - screen: home\n    duration: 5\n    ${bad}\n`,
      CATALOGUE, HOW
    );
    assert.ok((errors ?? []).some(e => /needs words to say/.test(e)), bad);
  }
});

/* The one that silently ate half a sentence. */
test('a comma outside quotes is caught rather than swallowing words', () => {
  const { warnings } = parse(
    'video: help\nshots:\n  - screen: home\n    duration: 5\n' +
    '    say:\n      - { at: 1, text: naam, rate aur quantity }\n',
    CATALOGUE, HOW
  );
  assert.ok(
    (warnings ?? []).some(w => /not part of a spoken line/.test(w)),
    'YAML ends the value at the comma and reads the rest as a setting'
  );
  assert.ok((warnings ?? []).some(w => /quotes/.test(w)), 'and it says what to do about it');
});

/* A narrator is not in the picture, so a sentence finishing after the cut is
 * how a how-to is meant to sound. Warning about it drowned the two faults
 * that mattered in five complaints about something correct. */
test('a narrator may finish a sentence after the picture cuts', () => {
  const carriesOver = [{ at: 1, length: 4, shotEnds: 3, shotSeconds: 3, instruction: true }];
  assert.deepEqual(troublesWith(carriesOver, 30), []);

  /* Dialogue belonging to a screen is still held to its shot. */
  const dialogue = [{ at: 1, length: 4, shotEnds: 3, shotSeconds: 3 }];
  assert.ok(troublesWith(dialogue, 30).some(s => /past the end of its shot/.test(s)));
});

test('two instructions talking at once is still a fault', () => {
  const said = troublesWith(
    [
      { at: 1, length: 5, shotEnds: 20, shotSeconds: 20, instruction: true },
      { at: 3, length: 2, shotEnds: 20, shotSeconds: 20, instruction: true }
    ],
    30
  );
  assert.ok(said.some(s => /overlap/.test(s)), 'nobody can follow two sentences at once');
});

test('an instruction cut off by the end of the clip is still a fault', () => {
  const said = troublesWith(
    [{ at: 8, length: 5, shotEnds: 99, shotSeconds: 99, instruction: true }], 10
  );
  assert.ok(said.some(s => /past the end of the clip/.test(s)), 'the last step is the one they need');
});

/* The clip that is actually going out to customers. */
test('the support how-to has no voice timing faults left', async () => {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(new URL('../recipes/help-make-a-bill.yaml', import.meta.url), 'utf8');
  const { recipe, errors, warnings } = parse(text, CATALOGUE, HOW);

  assert.deepEqual(errors ?? [], []);
  assert.deepEqual(warnings ?? [], [], 'a clip sent to a stuck customer should be clean');

  const lines = voiceLines(recipe);
  assert.equal(lines.length, 5, 'one instruction per step, two on the item screen');
  for (const l of lines) assert.ok(l.instruction, 'all of them are instructions');

  /* Measured speech lengths from the synthesiser, in order. The clip was
     re-timed around these, so this is the arithmetic that keeps it right. */
  const spoken = [5.0, 4.7, 4.3, 3.2, 6.0];
  const placed = lines.map((l, i) => ({
    at: l.at, length: spoken[i], shotEnds: Infinity, shotSeconds: 0, instruction: true
  }));
  assert.deepEqual(troublesWith(placed, totalDuration(recipe)), []);
});
