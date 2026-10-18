import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/recipe.js';

const CATALOGUE = {
  home: ['create-invoice-cta'],
  'create-invoice': ['add-item', 'save-and-share']
};

const GOOD = `
video: demo
business: { name: Agarwal Super Market }
party: { name: Ramesh Kumar }
items:
  - { name: Tata Salt 1kg, rate: 28, qty: 10 }
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 1.0, do: tap, target: create-invoice-cta }
  - screen: create-invoice
    duration: 3.0
    actions:
      - { at: 0.5, do: addItem, index: 0 }
      - { at: 2.0, do: tap, target: save-and-share }
`;

test('a valid recipe parses with no errors', () => {
  const r = parse(GOOD, CATALOGUE);
  assert.ok(!r.errors, 'expected no errors, got: ' + JSON.stringify(r.errors));
  assert.equal(r.recipe.video, 'demo');
  assert.equal(r.recipe.shots.length, 2);
  assert.equal(r.recipe.items[0].rate, 28);
  assert.deepEqual(r.warnings, []);
});

test('malformed YAML is reported, not thrown', () => {
  const r = parse('shots: [unclosed', CATALOGUE);
  assert.ok(r.errors, 'expected errors');
  assert.match(r.errors[0], /YAML/i);
});

test('a missing shots list is an error', () => {
  const r = parse('video: demo', CATALOGUE);
  assert.ok(r.errors.some(e => /shots/.test(e)));
});

test('an unknown screen names the valid screens', () => {
  const r = parse(`
shots:
  - screen: dashborad
    duration: 1.0
`, CATALOGUE);
  assert.ok(r.errors.some(e => /dashborad/.test(e)), 'should quote the bad name');
  assert.ok(r.errors.some(e => /home/.test(e)), 'should list valid screens');
});

test('an unknown tap target names the valid targets', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 0.5, do: tap, target: nope }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /nope/.test(e)));
  assert.ok(r.errors.some(e => /create-invoice-cta/.test(e)));
});

test('an unknown action verb is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 0.5, do: levitate }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /levitate/.test(e)));
});

test('an action past the end of its shot is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 5.0, do: tap, target: create-invoice-cta }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /5/.test(e) && /2/.test(e)));
});

test('a non-positive duration is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 0
`, CATALOGUE);
  assert.ok(r.errors.some(e => /duration/.test(e)));
});

test('addItem beyond the item list is an error naming the index and item count', () => {
  const r = parse(`
items:
  - { name: Salt, rate: 10, qty: 1 }
shots:
  - screen: create-invoice
    duration: 2.0
    actions:
      - { at: 0.5, do: addItem, index: 7 }
`, CATALOGUE);
  assert.ok(r.errors, 'should be fatal');
  assert.ok(r.errors.some(e => /shot 1, action 1/.test(e) && /7/.test(e) && /lists 1/.test(e)));
});

test('a very short shot warns but still parses', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 0.2
`, CATALOGUE);
  assert.ok(!r.errors);
  assert.ok(r.warnings.some(w => /short/i.test(w)));
});

test('a very long video warns', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 61
`, CATALOGUE);
  assert.ok(!r.errors);
  assert.ok(r.warnings.some(w => /probably wrong/.test(w)));
});

test('missing optional sections default to empty', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 1.0
`, CATALOGUE);
  assert.deepEqual(r.recipe.items, []);
  assert.equal(r.recipe.business.name, '');
  assert.equal(r.recipe.party.name, '');
});

const shotWith = (screen, duration, actionLine) => `
shots:
  - screen: ${screen}
    duration: ${duration}
    actions:
      - ${actionLine}
`;

test('a type action missing its text is an error', () => {
  const r = parse(shotWith('create-invoice', 2.0, '{ at: 0.5, do: type, target: add-item }'), CATALOGUE);
  assert.ok(r.errors.some(e => /shot 1, action 1/.test(e) && /text/.test(e)));
});

test('a selectParty action parses fine', () => {
  const r = parse(shotWith('create-invoice', 2.0, '{ at: 0.5, do: selectParty }'), CATALOGUE);
  assert.ok(!r.errors, 'expected no errors, got: ' + JSON.stringify(r.errors));
  assert.equal(r.recipe.shots[0].actions[0].do, 'selectParty');
});

test('a negative at is an error', () => {
  const r = parse(shotWith('home', 2.0, '{ at: -1, do: tap, target: create-invoice-cta }'), CATALOGUE);
  assert.ok(r.errors.some(e => /"at"/.test(e) && /-1/.test(e)));
});

test('a non-integer addItem index is an error', () => {
  const r = parse(`
items:
  - { name: Salt, rate: 10, qty: 1 }
shots:
  - screen: create-invoice
    duration: 2.0
    actions:
      - { at: 0.5, do: addItem, index: 0.5 }
`, CATALOGUE);
  assert.ok(r.errors.some(e => /index/.test(e) && /0.5/.test(e)));
});

test('a negative duration is an error', () => {
  const r = parse(`
shots:
  - screen: home
    duration: -3
`, CATALOGUE);
  assert.ok(r.errors.some(e => /shot 1/.test(e) && /duration/.test(e)));
});

test('actions given as a string is an error, not silently dropped', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions: tap home
`, CATALOGUE);
  assert.ok(r.errors.some(e => /shot 1/.test(e) && /actions/.test(e) && /list/.test(e)));
});

test('a shot with no actions key is valid', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
`, CATALOGUE);
  assert.ok(!r.errors);
  assert.deepEqual(r.recipe.shots[0].actions, []);
});

test('screen: constructor returns errors rather than throwing', () => {
  let r;
  assert.doesNotThrow(() => {
    r = parse(`
shots:
  - screen: constructor
    duration: 2.0
    actions:
      - { at: 0.5, do: tap, target: x }
`, CATALOGUE);
  });
  assert.ok(r.errors.some(e => /constructor/.test(e) && /home/.test(e)));
});

test('warnings are still returned alongside errors', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 0.2
  - screen: nowhere
    duration: 1.0
`, CATALOGUE);
  assert.ok(r.errors.some(e => /shot 2/.test(e)));
  assert.ok(r.warnings.some(w => /shot 1/.test(w) && /short/i.test(w)));
});

test('items present but not a list is an error', () => {
  const r = parse(`
items: Salt
shots:
  - screen: home
    duration: 2.0
`, CATALOGUE);
  assert.ok(r.errors, 'expected errors');
  assert.ok(r.errors.some(e => /items/.test(e) && /list/.test(e)));
});

test('an absent items key stays valid', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
`, CATALOGUE);
  assert.ok(!r.errors, 'a screen with no bill on it is legitimate');
  assert.deepEqual(r.recipe.items, []);
});

const withVideo = v => GOOD.replace('video: demo', 'video: ' + v);

test('video must be a plain name, never a path', () => {
  for (const bad of ['../x', 'a/b', '..', 'has space', '""']) {
    const res = parse(withVideo(bad.startsWith('"') ? bad : JSON.stringify(bad)), CATALOGUE);
    assert.ok(res.errors, 'should reject ' + bad);
    assert.match(res.errors.join('\n'), /"video"/);
  }
  const res = parse(withVideo('"../x"'), CATALOGUE);
  assert.ok(res.errors.join('\n').includes('"../x"'), 'names the offending value');
});

test('video must be a string', () => {
  for (const bad of ['[1, 2]', '{ a: 1 }', '123', 'true']) {
    assert.ok(parse(withVideo(bad), CATALOGUE).errors, 'should reject ' + bad);
  }
});

test('an absent video defaults to a safe name', () => {
  const res = parse(GOOD.replace('video: demo\n', ''), CATALOGUE);
  assert.equal(res.recipe.video, 'untitled');
});

test('invoice defaults when absent and is read when present', () => {
  const d = parse(GOOD, CATALOGUE).recipe.invoice;
  assert.equal(typeof d.number, 'number');
  assert.equal(typeof d.date, 'string');
  const res = parse(withVideo('demo\ninvoice: { number: 7001, date: "15/11/2026" }'), CATALOGUE);
  assert.deepEqual(res.recipe.invoice, { number: 7001, date: '15/11/2026' });
});

test('a partly specified invoice keeps the default for the rest', () => {
  const res = parse(withVideo('demo\ninvoice: { number: 7001 }'), CATALOGUE);
  assert.equal(res.recipe.invoice.number, 7001);
  assert.equal(typeof res.recipe.invoice.date, 'string');
});

test('a malformed invoice is an error', () => {
  for (const bad of ['{ number: abc }', '{ number: 1.5 }', '{ number: 0 }', '{ date: 5 }', '[1]']) {
    assert.ok(parse(withVideo('demo\ninvoice: ' + bad), CATALOGUE).errors, 'should reject ' + bad);
  }
});

test('duration must be a real number, not a coerced value', () => {
  for (const bad of ['true', '""', '"2"', 'null', '[]']) {
    const res = parse(GOOD.replace('duration: 2.0', 'duration: ' + bad), CATALOGUE);
    assert.ok(res.errors, 'should reject duration ' + bad);
    assert.match(res.errors.join('\n'), /duration must be a positive number/);
  }
});

test('an action "at" must be a real number, not a coerced value', () => {
  for (const bad of ['true', '""', '"1"', 'null']) {
    const res = parse(GOOD.replace('at: 1.0', 'at: ' + bad), CATALOGUE);
    assert.ok(res.errors, 'should reject at ' + bad);
    assert.match(res.errors.join('\n'), /"at" must be a number/);
  }
});

test('brand: absent means no end card', () => {
  const { recipe } = parse(GOOD, CATALOGUE);
  assert.equal(recipe.brand.endCard, null);
});

test('brand: end card defaults duration and tagline', () => {
  const { recipe, errors } = parse(GOOD + '\nbrand:\n  endCard: {}\n', CATALOGUE);
  assert.deepEqual(errors ?? [], []);
  assert.equal(recipe.brand.endCard.duration, 1.6);
  assert.equal(recipe.brand.endCard.tagline, 'India ka No.1 Billing App');
});

test('brand: non-positive endCard duration is an error', () => {
  for (const d of ['0', '-1', 'soon']) {
    const { errors } = parse(GOOD + `\nbrand:\n  endCard: { duration: ${d} }\n`, CATALOGUE);
    assert.ok(errors.some(e => /endCard\.duration/.test(e)), d);
  }
});

test('brand: unknown key warns but still parses', () => {
  const { recipe, warnings } = parse(GOOD + '\nbrand:\n  sparkle: true\n', CATALOGUE);
  assert.ok(recipe);
  assert.ok(warnings.some(w => /brand\.sparkle/.test(w)));
});


/* ---- pacing ----
 * Length is an editorial call, so none of these are errors. They flag the two
 * ways a clip loses a viewer: a beat too quick to read, or a stretch where
 * nothing happens and they scroll past. */

test('dead air mid-clip warns', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 6.0
    actions:
      - { at: 0.5, do: tap, target: create-invoice-cta }
  - screen: home
    duration: 2.0
`, CATALOGUE);
  assert.ok(!r.errors);
  assert.ok(r.warnings.some(w => /nothing happens/.test(w)), 'a 5.5s tail is dead air');
});

test('a trailing hold on the FINAL shot is not dead air', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 0.5, do: tap, target: create-invoice-cta }
  - screen: home
    duration: 6.0
    actions:
      - { at: 0.5, do: tap, target: received-payment }
`, CATALOGUE);
  assert.ok(!r.warnings.some(w => /nothing happens/.test(w)),
    'letting the last beat land is good pacing, not a defect');
});

test('actions crammed too close together warn', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 3.0
    actions:
      - { at: 0.5, do: tap, target: create-invoice-cta }
      - { at: 0.7, do: tap, target: received-payment }
`, CATALOGUE);
  assert.ok(r.warnings.some(w => /too quick to follow/.test(w)));
});

test('comfortably spaced actions do not warn', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 3.0
    actions:
      - { at: 0.5, do: tap, target: create-invoice-cta }
      - { at: 1.8, do: tap, target: received-payment }
`, CATALOGUE);
  assert.ok(!r.warnings.some(w => /too quick/.test(w)));
});

test('a brief shot with nothing happening warns', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 0.8
`, CATALOGUE);
  assert.ok(r.warnings.some(w => /too brief to register/.test(w)));
});

test('a well-paced clip raises no warnings at all', () => {
  const r = parse(`
items:
  - { name: TATA SALT 1KG, rate: 30, qty: 10, gst: 5 }
shots:
  - screen: home
    duration: 2.0
    actions:
      - { at: 1.3, do: tap, target: create-invoice-cta }
  - screen: create-invoice
    duration: 4.6
    actions:
      - { at: 0.6, do: selectParty }
      - { at: 2.4, do: addItem, index: 0 }
      - { at: 4.0, do: tap, target: save-and-share }
  - screen: home
    duration: 1.8
`, CATALOGUE);
  assert.ok(!r.errors, JSON.stringify(r.errors));
  assert.deepEqual(r.warnings, [], 'a well-paced clip should be silent');
});

/* ---- the WhatsApp payoff ----
 * A generated video once ran WhatsApp -> back to the app -> WhatsApp again,
 * which reads as a mistake. Sending the invoice is the payoff; the clip rests
 * there. */

test('returning to the app after the invoice is delivered warns', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
  - screen: wa-chat
    duration: 2.0
  - screen: home
    duration: 2.0
`, { ...CATALOGUE, 'wa-chat': ['back'] });
  assert.ok(!r.errors, JSON.stringify(r.errors));
  assert.ok(r.warnings.some(w => /after the invoice is delivered/.test(w)));
  assert.ok(r.warnings.some(w => /home/.test(w)), 'should name the offending screen');
});

test('ending on the delivered chat does not warn', () => {
  const r = parse(`
shots:
  - screen: home
    duration: 2.0
  - screen: wa-chat
    duration: 2.0
`, { ...CATALOGUE, 'wa-chat': ['back'] });
  assert.ok(!r.warnings.some(w => /after the invoice is delivered/.test(w)));
});

test('another WhatsApp shot after the chat is fine', () => {
  const r = parse(`
shots:
  - screen: wa-chat
    duration: 2.0
  - screen: wa-attach
    duration: 1.5
`, { ...CATALOGUE, 'wa-chat': ['back'], 'wa-attach': ['send'] });
  assert.ok(!r.warnings.some(w => /after the invoice is delivered/.test(w)));
});

test('a target named on the wrong screen says which screen has it', () => {
  /* The bare list of valid targets does not help with the commonest mistake:
     whoever wrote the shot knew what they wanted to tap and had the wrong
     screen under it. "add-item" is a real button - on another screen. */
  const { errors } = parse(`
video: wrong-screen
business: { name: Shop }
party: { name: Ravi }
invoice: { number: 1, date: "01/01/2026" }
items: [{ name: X, rate: 10, qty: 1, gst: 5, unit: PCS }]
shots:
  - screen: home
    duration: 2
    actions:
      - { at: 1, do: tap, target: add-item }
`, CATALOGUE);
  assert.ok(errors, 'a button from another screen must not pass');
  const said = errors.join(' ');
  assert.match(said, /is not on the home screen/);
  assert.match(said, /It is on create-invoice/);
});

test('a target that exists nowhere just lists what is valid', () => {
  /* And no "it is on" clause when there is no such button anywhere: a made-up
     name must not be answered with a confident pointer to nothing. */
  const { errors } = parse(`
video: no-such-button
business: { name: Shop }
party: { name: Ravi }
invoice: { number: 1, date: "01/01/2026" }
items: [{ name: X, rate: 10, qty: 1, gst: 5, unit: PCS }]
shots:
  - screen: home
    duration: 2
    actions:
      - { at: 1, do: tap, target: total }
`, CATALOGUE);
  assert.ok(errors);
  const said = errors.join(' ');
  assert.match(said, /"total" is not on the home screen/);
  assert.doesNotMatch(said, /It is on/);
});

test('a duration of zero is refused rather than flickering', () => {
  /* Zero divides: ramp returns NaN on the single frame where the clock is
     exactly on the action, the browser drops a transform it cannot read, and
     the list snaps back for one frame. Nobody reviewing a shot list would
     catch that, and nobody watching would be able to say what they saw. */
  for (const bad of [0, -1]) {
    const { errors } = parse(`
video: bad-duration
business: { name: Shop }
party: { name: Ravi }
invoice: { number: 1, date: "01/01/2026" }
items: [{ name: X, rate: 10, qty: 1, gst: 5, unit: PCS }]
shots:
  - screen: home
    duration: 3
    actions:
      - { at: 1, do: tap, target: create-invoice-cta, duration: ${bad} }
`, CATALOGUE);
    assert.ok(errors, `duration ${bad} should be refused`);
    assert.match(errors.join(' '), /duration must be a number of seconds greater than zero/);
  }
});

test('everything that reads a shot list tells it which screens scroll', async () => {
  /* parse() sees screen names and their buttons, never the screens
     themselves, so it has to be TOLD which ones have a list worth scrolling.
     Left out, the answer is "none", and a perfectly good scroll is refused
     with "Screens that scroll: ." - which is what the studio did, because the
     command line was wired up and the web page was not.

     Checked at the source rather than by behaviour: a third caller added
     later would be wrong in exactly the same way, and nothing else would
     notice. */
  const { readFile } = await import('node:fs/promises');
  const callers = ['../worker/compile.js', '../web/app/page.tsx'];

  for (const file of callers) {
    const src = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(src, /parse\(/, `${file} no longer reads a shot list - update this test`);
    assert.match(
      src, /scrollable:\s*scrollables\(\)/,
      `${file} reads a shot list without saying which screens scroll`
    );
  }
});
