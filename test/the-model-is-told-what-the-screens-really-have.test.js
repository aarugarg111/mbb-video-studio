/* Two catalogues, and the model only ever sees one of them.
 *
 * screens/index.js is the truth: the renderer draws from it, the validator
 * checks against it, and audit-targets.mjs proves every coordinate in it
 * against a real render. web/lib/schema.ts keeps a SECOND, hand-written copy,
 * and that copy is what goes into the briefing - so it is the only thing the
 * AI knows about.
 *
 * When they disagree, the model is working from a false map. It cannot
 * propose a button it has not been told about, and it will confidently use
 * one that no longer exists. Asked "how do I add a party", it answered "tap
 * Parties at the bottom" and tapped REPORTS - because the home screen's
 * bottom nav had been drawn without ids for as long as the screen had
 * existed, so neither catalogue listed it and the nearest target won. Two
 * individually valid halves, teaching a customer the wrong button.
 *
 * schema.ts says of itself "that is the only list, and everything else is
 * derived from it. Miss it and the model can never propose the screen" - a
 * manual step, remembered until it is not. This makes forgetting loud.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogue } from '../screens/index.js';

/* schema.ts is TypeScript and this suite is plain node, so the literal is
 * read rather than imported. Narrow on purpose: it matches the one shape the
 * file uses, and a shape it cannot read shows up as a missing screen rather
 * than as a pass. */
function screensInTheBriefing() {
  const text = readFileSync(new URL('../web/lib/schema.ts', import.meta.url), 'utf8');
  const from = text.indexOf('export const SCREENS');
  assert.ok(from > 0, 'schema.ts no longer declares SCREENS - update this test');
  /* Comments out first. They are full of screen names and button names in
   * prose - this file explains itself at length - and a parser reading those
   * as declarations finds whatever it is looking for. An entry may also be
   * written across several lines, so the list body is matched across
   * newlines rather than line by line. */
  /* The object closes with "} as const;", not "};". Looking for the wrong
   * terminator found nothing, so the slice ran to the end of the FILE and
   * swept up every other map in it - and the drift it then reported was
   * invented by the parser. Asserted rather than assumed, because a silent
   * mis-parse here reads as a finding about the briefing. */
  const rest = text.slice(from);
  const end = rest.indexOf('} as const;');
  assert.ok(end > 0, 'SCREENS no longer closes with "} as const;" - update this test');

  const body = rest
    .slice(0, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const found = {};
  for (const m of body.matchAll(/'?([A-Za-z0-9-]+)'?:\s*\[([^\]]*)\]/g)) {
    found[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
  }
  return found;
}

/* There is no excused list, and there was nearly a bogus one.
 *
 * A first run of this reported three screens listing their zoom places
 * instead of their buttons, and it was convincing: a bill has little to press
 * and plenty worth a close-up, so it even had a plausible reason. It was the
 * parser reading past the end of the object and sweeping up other maps in the
 * file. The two catalogues agree everywhere except where a button is genuinely
 * missing, which is the whole point of checking.
 *
 * So this holds absolutely. If a screen ever does need excusing, write down
 * WHY here and add a reverse guard that fails when the excuse stops being
 * true - but check the parser first. */

test('every screen the renderer has is one the model is told about', () => {
  const shown = screensInTheBriefing();
  const missing = Object.keys(catalogue()).filter(s => !(s in shown));
  assert.deepEqual(
    missing, [],
    'these screens exist and the AI has never heard of them, so it can never ' +
    'propose one: add them to SCREENS in web/lib/schema.ts'
  );
});

test('the model is not told about screens that do not exist', () => {
  const real = catalogue();
  const invented = Object.keys(screensInTheBriefing()).filter(s => !(s in real));
  assert.deepEqual(
    invented, [],
    'the briefing offers screens the renderer cannot draw, so a recipe using ' +
    'one is refused after the clip has been written'
  );
});

test('every button a screen really has is one the model is told about', () => {
  const real = catalogue();
  const shown = screensInTheBriefing();
  const wrong = [];

  for (const [screen, targets] of Object.entries(real)) {
    const told = shown[screen] ?? [];
    const unknown = targets.filter(t => !told.includes(t));
    const invented = told.filter(t => !targets.includes(t));
    if (unknown.length) wrong.push(`${screen}: the model is never told about ${unknown.join(', ')}`);
    if (invented.length) wrong.push(`${screen}: the briefing invents ${invented.join(', ')}`);
  }

  assert.deepEqual(
    wrong, [],
    'a model working from a false map either cannot use a button that exists, ' +
    'or confidently uses one that does not - and both look like the model ' +
    'being careless. Update SCREENS in web/lib/schema.ts.'
  );
});

/* The specific one that caused the wrong-button clip. */
test('the home screen bottom nav is a button the model knows it can press', () => {
  const real = catalogue();
  assert.ok(real.home.includes('nav-parties'), 'the screen draws the nav, so it must be tappable');
  assert.ok(
    (screensInTheBriefing().home ?? []).includes('nav-parties'),
    'and the model has to be told, or it reaches for whatever target it does know'
  );
});
