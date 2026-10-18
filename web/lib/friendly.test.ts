import test from 'node:test';
import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import { SCREENS } from './schema';
import { screenLabel, stepLabel, stepsFor, SCROLLABLE } from './friendly';

/* Whether a label still reads as a machine name rather than as English. An id
   is lower case with hyphens and no spaces; "Age-wise (F6)" is Tally's own
   term and perfectly good. */
const idLike = (label: string) => !label.includes(' ') && /[a-z]-[a-z]/.test(label);

test('every screen the form can offer has a name a person would use', () => {
  /* The point of the form is that nobody has to learn "sales-list". A screen
     with no entry falls back to a tidied id, which is readable but is not a
     decision - so this checks the fallback never shows through for a screen
     the form actually offers. */
  for (const screen of Object.keys(SCREENS)) {
    const { name } = screenLabel(screen);
    assert.ok(name.length > 0, `${screen} has no name`);
    assert.notEqual(name, screen, `${screen} is still showing its own id`);
    /* An id has no spaces: "sales-list" fails, "Follow-up history" does not.
       Hyphens alone are ordinary English and catch the wrong things. */
    assert.ok(idLike(name) === false, `${screen} reads like an id: ${name}`);
  }
});

test('every button the form can offer has a name too', () => {
  const missing: string[] = [];
  for (const [screen, targets] of Object.entries(SCREENS)) {
    for (const target of targets as readonly string[]) {
      const label = stepLabel(screen, target);
      if (idLike(label) || label === target) missing.push(`${screen}/${target} -> ${label}`);
    }
  }
  assert.deepEqual(missing, [], 'these buttons still read like ids');
});

test('the form offers exactly what the screen can do, and a scroll where there is a list', () => {
  /* Offering a button a screen does not have is the mistake the form exists to
     make impossible, so the list comes from the catalogue rather than from a
     second copy of it. */
  for (const [screen, targets] of Object.entries(SCREENS)) {
    const offered = stepsFor(screen).map(s => s.id).filter(id => id !== '__scroll');
    assert.deepEqual(offered, [...(targets as readonly string[])], `${screen} offers the wrong steps`);
  }
  assert.ok(stepsFor('sales-list').some(s => s.scroll), 'the day’s bills should be scrollable');
  assert.ok(!stepsFor('invoice-created').some(s => s.scroll), 'a bill is not a list');
});

test('a screen named as scrollable is a screen that exists', () => {
  for (const screen of SCROLLABLE) {
    assert.ok(screen in SCREENS, `${screen} is not a screen`);
  }
});

test('the form writes a shot list the renderer can still read', () => {
  /* The form edits the same YAML the box holds. If what it writes back were
     not loadable - or lost the shape of a shot - the render would fail after
     somebody moved a slider, which is the worst possible place to find out. */
  const written = yaml.dump({
    video: 'momos-day',
    sales: { dayTotal: 10570, netProfit: 2420 },
    shots: [
      { screen: 'sales-list', duration: 7, actions: [
        { at: 1.2, do: 'tap', target: 'change-range' },
        { at: 2.8, do: 'scroll', distance: 300, duration: 1.6 }
      ] },
      { screen: 'profit-loss', duration: 4, actions: [] }
    ]
  });

  const back = yaml.load(written) as {
    sales: { dayTotal: number }; shots: { screen: string; duration: number; actions: unknown[] }[];
  };
  assert.equal(back.sales.dayTotal, 10570);
  assert.equal(back.shots.length, 2);
  assert.equal(back.shots[0].screen, 'sales-list');
  assert.equal(back.shots[0].actions.length, 2);
  assert.deepEqual(back.shots[0].actions[1], { at: 2.8, do: 'scroll', distance: 300, duration: 1.6 });
});
