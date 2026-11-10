/* A message nobody can see is the same as no message.
 *
 * The studio reports every failure in one block at the FOOT of the page.
 * Sign-in is the first thing on it, so a rejected team password put its
 * explanation several screens below the button that caused it. What came
 * back was "it is not signing in - nothing happens at all": the page had
 * said exactly what was wrong, off-screen, and the button read as dead.
 *
 * That cost a round trip of guessing at a fault the page already knew. So
 * each control that can fail on its own shows its own failure, and this
 * checks it stays that way - at the source, because the alternative is a
 * browser and this is one JSX line that is easy to drop in a refactor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../web/app/page.tsx', import.meta.url), 'utf8');

/* The sign-in panel, from its own marker to the end of the block. */
function signInPanel(src) {
  const start = src.indexOf('TEAM_MODE && !signedIn && !checkingSession');
  assert.ok(start > 0, 'the sign-in panel has moved - update this test');
  return src.slice(start, start + 1400);
}

test('a rejected password is reported inside the sign-in panel', () => {
  const panel = signInPanel(page);
  assert.match(panel, /Sign in/, 'this is the right block');
  assert.match(
    panel, /signInError/,
    'the sign-in panel does not show its own failure, so a rejected password ' +
    'reports itself at the bottom of the page where nobody looking at the ' +
    'button will see it'
  );
});

test('the sign-in failure is kept apart from the page-wide error', () => {
  /* Both rendering the same string would show it twice. They are separate
     pieces of state for that reason, not by accident. */
  assert.match(page, /const \[signInError, setSignInError\]/);
  assert.match(
    page, /setSignInError\(e instanceof Error \? e\.message/,
    'submitPassword must put the reason into the panel the person is looking at'
  );
});
