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
import { SCREENS } from '../screens/index.js';

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
