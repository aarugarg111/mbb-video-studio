import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropImpossible } from './possible';
import { parse } from '../../src/recipe.js';
import { catalogue, howToValidate, scrollables, zoomCatalogue, screenTimings } from '../../screens/index.js';

/* The studio's own options, not a hand-made set. Writing those out by hand
 * here is how the eval came to be stricter than production and blamed the
 * model for it. */
const validate = (text: string) =>
  parse(text, catalogue(), howToValidate()) as { errors?: string[] };

/* A zoom to a label that is genuinely on no screen. "invoice-date" looked
 * like the example to use - the eval refused one - but invoice-created has
 * an invoice-date to zoom to, and the refusal was the harness's own. */
const INVENTED_ZOOM =
  'video: t\naspect: "9:16"\nshots:\n' +
  '  - screen: invoice-created\n    duration: 4\n' +
  '    actions:\n      - { at: 1, do: zoom, target: gst-summary, to: 2 }\n';

test('the fixture is really invented, so this test is about what it says', () => {
  const places = (zoomCatalogue() as Record<string, string[]>)['invoice-created'] ?? [];
  assert.ok(places.length, 'invoice-created has places to zoom to');
  assert.ok(!places.includes('gst-summary'), 'and gst-summary is not one of them');
  assert.ok(places.includes('invoice-date'), 'while invoice-date IS one - see the note above');
});

test('an invented zoom is dropped and the rest of the clip survives', () => {
  assert.ok(validate(INVENTED_ZOOM).errors?.length, 'the validator refuses it as it stands');

  const { recipe, dropped } = dropImpossible(INVENTED_ZOOM);
  assert.deepEqual(validate(recipe).errors ?? [], [], 'and now it renders');
  assert.equal(dropped.length, 1);
  assert.match(dropped[0], /gst-summary/);
  assert.match(dropped[0], /shot 1, action 1/, 'it says where, like the validator does');
  assert.match(recipe, /screen: invoice-created/, 'the shot itself is still there');
});

/* The rule that keeps this from becoming a silent repair. */
test('nothing is dropped without being reported', () => {
  assert.ok(dropImpossible(INVENTED_ZOOM).dropped.length, 'a drop comes with a sentence about it');
});

test('a tap on the wrong screen says which screen it belongs to', () => {
  /* The commonest mistake, and the one where the note is actionable: whoever
     wrote the shot knows what they meant to tap, they had the wrong screen
     under it. open-profit-loss is real - on the laptop report list. */
  const text =
    'video: t\nshots:\n  - screen: home\n    duration: 3\n' +
    '    actions:\n      - { at: 1, do: tap, target: open-profit-loss }\n';
  const { recipe, dropped } = dropImpossible(text);
  assert.equal(dropped.length, 1);
  assert.match(dropped[0], /is on mbb-desktop-report-list/);
  assert.deepEqual(validate(recipe).errors ?? [], [], 'and what is left renders');
});

test('a scroll on a screen with nothing to scroll is dropped', () => {
  assert.ok(!(scrollables() as string[]).includes('home'), 'the phone home screen does not scroll');

  const text =
    'video: t\nshots:\n  - screen: home\n    duration: 3\n' +
    '    actions:\n      - { at: 1, do: scroll }\n';
  const { dropped } = dropImpossible(text);
  assert.equal(dropped.length, 1);
  assert.match(dropped[0], /nothing long enough to scroll/);
});

/* The line this must not cross. An action is a detail of a shot; the shots
 * are what the video IS. There is no version of the clip without the screen,
 * so refusing is the only honest answer and the validator gives it. */
test('an invented SCREEN is left alone for the validator to refuse', () => {
  const text =
    'video: t\nshots:\n  - screen: mbb-desktop-nothing-like-this\n    duration: 3\n' +
    '    actions:\n      - { at: 1, do: tap, target: whatever }\n';
  const { recipe, dropped } = dropImpossible(text);
  assert.deepEqual(dropped, [], 'nothing is dropped out from under it');
  assert.equal(recipe, text, 'and it is handed on exactly as it came');
  assert.ok(validate(recipe).errors?.length, 'so the validator still says no');
});

test('a recipe with nothing wrong is not rewritten at all', () => {
  /* Dumping it would hand somebody a page of re-indented YAML they did not
     write, for no reason. */
  const fine =
    'video: t\nshots:\n  - screen: home\n    duration: 3\n' +
    '    actions:\n      - { at: 1, do: tap, target: create-invoice-cta }\n';
  assert.deepEqual(validate(fine).errors ?? [], [], 'the fixture is a valid recipe');

  const { recipe, dropped } = dropImpossible(fine);
  assert.deepEqual(dropped, []);
  assert.equal(recipe, fine, 'byte for byte');
});

test('an action with no target is left alone', () => {
  /* zoomOut carries none, and reading a missing target as a wrong one would
     drop the pull-back from every zoom in the studio. */
  const text =
    'video: t\nshots:\n  - screen: profit-loss\n    duration: 6\n' +
    '    actions:\n      - { at: 1, do: zoom, target: net-profit, to: 2 }\n' +
    '      - { at: 4, do: zoomOut }\n';
  assert.deepEqual(validate(text).errors ?? [], [], 'the fixture is a valid recipe');
  assert.deepEqual(dropImpossible(text).dropped, []);
});

test('a zoom to a place that is only for looking at is kept', () => {
  /* The exact thing the eval was refusing. A bill has little to press and
     plenty worth a close-up, and those places are zoomable on purpose. */
  const text =
    'video: t\nshots:\n  - screen: invoice-created\n    duration: 5\n' +
    '    actions:\n      - { at: 1, do: zoom, target: bill-items, to: 2 }\n';
  assert.deepEqual(validate(text).errors ?? [], [], 'the studio allows it');
  assert.deepEqual(dropImpossible(text).dropped, [], 'so this must not drop it');
});

test('unreadable YAML is handed on untouched, not swallowed', () => {
  const broken = 'video: t\nshots: [ this is not';
  const { recipe, dropped } = dropImpossible(broken);
  assert.equal(recipe, broken);
  assert.deepEqual(dropped, []);
});

test('it never throws, whatever shape the recipe is in', () => {
  for (const odd of ['', 'null', '[]', 'shots: 3', 'shots:\n  - 7\n', 'shots:\n  - screen: home\n    actions: 4\n']) {
    assert.doesNotThrow(() => dropImpossible(odd), JSON.stringify(odd));
  }
});

/* "The timings for each interface are not perfectly aligned."
 *
 * A handful of screens are an animation rather than a still - the AI call
 * writes a transcript across the shot, the laptop invoice fills itself in
 * after a tap. Cut short, the thing the screen was in the middle of is
 * sliced off. The clip still renders and still parses, so nothing in the
 * studio was lining these up; the requirement lived in the briefing as
 * prose, which held for as long as the model chose to follow it. */
/* The floor is read from the screen, never written in here as a number.
 * These tests pinned 9 and 10, and then a real voice measured the AI call
 * and the floor moved to 10.5 - so three tests failed for being out of date
 * rather than for finding anything. The screen is the one place that knows. */
const FLOOR = (screenTimings() as Record<string, number>)['mcf-ai-call'];

test('the AI call screen declares a floor at all, or these prove nothing', () => {
  assert.ok(Number.isFinite(FLOOR) && FLOOR > 0, 'mcf-ai-call must declare needsSeconds');
});

test('a shot too short for what its screen is doing is raised to fit', () => {
  const tooShort = 'video: t\nshots:\n  - screen: mcf-ai-call\n    duration: 3\n';
  const { recipe, dropped } = dropImpossible(tooShort);

  assert.match(recipe, new RegExp(`duration: ${FLOOR}`), 'raised to what the screen needs');
  assert.equal(dropped.length, 1);
  assert.match(dropped[0], new RegExp(`needs about ${FLOOR}s`));
  assert.match(dropped[0], /raised/, 'and it is reported, never silent');
  assert.deepEqual(validate(recipe).errors ?? [], []);
});

test('a shot already long enough is left exactly alone', () => {
  const fine = `video: t\nshots:\n  - screen: mcf-ai-call\n    duration: ${FLOOR + 0.5}\n`;
  const { recipe, dropped } = dropImpossible(fine);
  assert.deepEqual(dropped, []);
  assert.equal(recipe, fine, 'byte for byte');
});

test('the validator says so too, for a recipe written by hand', () => {
  /* The studio stays strict where somebody can fix it themselves, and that
     warning is what the eval counts as roughness. */
  const { warnings } = parse(
    'video: t\nshots:\n  - screen: mcf-ai-call\n    duration: 3\n',
    catalogue(), howToValidate()
  ) as { warnings?: string[] };
  assert.ok(
    (warnings ?? []).some(w => new RegExp(`needs about ${FLOOR}s`).test(w)),
    (warnings ?? []).join(' / ')
  );
});
