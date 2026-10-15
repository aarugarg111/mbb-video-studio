import test from 'node:test';
import assert from 'node:assert/strict';
import { recastShape, screenOnShape } from '../src/shape.js';
import { catalogue, SCREENS } from '../screens/index.js';

const CAT = catalogue();

/* The studio's "Filmed on" picker was an instruction to the model and nothing
 * else, so choosing "a laptop" and getting a phone video was an ordinary
 * outcome rather than a bug anybody could see. These cover the swap that now
 * happens to the shot list itself, after the model has written it. */

const PHONE_RECIPE = {
  video: 'x',
  shots: [
    { screen: 'home', duration: 2, actions: [{ at: 1, do: 'tap', target: 'create-invoice-cta' }] },
    { screen: 'create-bill', duration: 2, actions: [{ at: 1, do: 'tap', target: 'add-items' }] },
    { screen: 'create-invoice', duration: 3, actions: [{ at: 1.5, do: 'tap', target: 'generate-bill' }] },
    { screen: 'invoice-created', duration: 2, actions: [{ at: 1, do: 'tap', target: 'share' }] }
  ]
};

test('asking for a laptop puts the laptop screens in the shot list', () => {
  const { recipe } = recastShape(PHONE_RECIPE, 'laptop', CAT);
  const screens = recipe.shots.map(s => s.screen);
  assert.ok(screens.includes('mbb-desktop-create-invoice'));
  assert.ok(screens.includes('mbb-desktop-invoice'));
  assert.ok(!screens.some(s => ['create-bill', 'create-invoice', 'invoice-created'].includes(s)));
});

test('a screen with no laptop version is left as it is', () => {
  /* WhatsApp is somebody else's app and is only ever drawn as a phone. A clip
     that passes through it should keep it rather than fail or silently lose
     the beat.

     This test used to say that of Scan & Record, on the grounds that a laptop
     does that feature through Mira's panel rather than a screen of its own.
     That was wrong: the laptop app has the whole flow, and a clip that cut
     away to a phone to scan a bill was showing a different story from the one
     the script asked for. */
  assert.equal(screenOnShape('wa-chat', 'laptop'), 'wa-chat');
  const { recipe } = recastShape(
    { video: 'x', shots: [{ screen: 'wa-chat', duration: 2, actions: [] }] },
    'laptop',
    CAT
  );
  assert.equal(recipe.shots[0].screen, 'wa-chat');
});

test('Scan & Record is the whole flow on a laptop too', () => {
  /* Same beats as the phone, in the interface a desk gives you. The laptop has
     no camera worth pointing at a bill, so the phone's "open the camera" step
     becomes "send the photo over from your phone" - the same step of the same
     flow - and both land on the same page, which is why two shots in a row
     become one. */
  assert.equal(screenOnShape('scan-bills', 'laptop'), 'mbb-desktop-scan');
  assert.equal(screenOnShape('scan-camera', 'laptop'), 'mbb-desktop-scan');
  assert.equal(screenOnShape('scan-reading', 'laptop'), 'mbb-desktop-scan-reading');
  assert.equal(screenOnShape('scan-done', 'laptop'), 'mbb-desktop-scan-done');

  const { recipe, dropped } = recastShape({
    video: 'x',
    shots: [
      { screen: 'scan-bills', duration: 2, actions: [{ at: 0.5, do: 'tap', target: 'upload-pdf' }] },
      { screen: 'scan-camera', duration: 2, actions: [{ at: 0.5, do: 'tap', target: 'open-camera' }] },
      { screen: 'scan-reading', duration: 2, actions: [] },
      { screen: 'scan-done', duration: 2, actions: [] }
    ]
  }, 'laptop', CAT);

  assert.deepEqual(dropped, [], 'every step of the scan survives the recast');
  assert.deepEqual(
    recipe.shots.map(s => s.screen),
    ['mbb-desktop-scan', 'mbb-desktop-scan-reading', 'mbb-desktop-scan-done'],
    'the two ways in are one page on a laptop, so those shots join'
  );

  const taps = recipe.shots[0].actions.map(a => a.target);
  assert.deepEqual(taps, ['upload-file', 'add-from-phone'], 'both ways in survive, renamed');
});

test('the dashboard and the sales list have laptop versions of their own', () => {
  /* Both were missing, so a laptop clip could not start where a phone clip
     starts, nor show the day's takings at all. */
  assert.equal(screenOnShape('home', 'laptop'), 'mbb-desktop-dashboard');
  assert.equal(screenOnShape('sales-list', 'laptop'), 'mbb-desktop-sales-list');
  assert.equal(screenOnShape('mbb-desktop-dashboard', 'phone'), 'home');
  assert.equal(screenOnShape('mbb-desktop-sales-list', 'phone'), 'sales-list');
});

test('a tap follows its button to the other screen', () => {
  const { recipe } = recastShape(PHONE_RECIPE, 'laptop', CAT);
  const form = recipe.shots.find(s => s.screen === 'mbb-desktop-create-invoice');
  const targets = form.actions.map(a => a.target);
  /* "Add Items" and "Generate Bill" are "Add item" and "Save" on a laptop. */
  assert.ok(targets.includes('add-item'), targets.join(', '));
  assert.ok(targets.includes('save'), targets.join(', '));
  for (const shot of recipe.shots) {
    for (const action of shot.actions ?? []) {
      if (!action.target) continue;
      assert.ok(CAT[shot.screen].includes(action.target),
        `${shot.screen} has no "${action.target}"`);
    }
  }
});

test('two phone screens that are one laptop screen become one shot', () => {
  /* Cutting from a screen to itself reads as the video having stalled. */
  const { recipe } = recastShape(PHONE_RECIPE, 'laptop', CAT);
  const forms = recipe.shots.filter(s => s.screen === 'mbb-desktop-create-invoice');
  assert.equal(forms.length, 1);
  assert.equal(forms[0].duration, 5, 'the two durations are added up');
  /* The later shot's actions move along by the first shot's length, or they
     would all fire in the opening seconds. */
  assert.deepEqual(forms[0].actions.map(a => a.at), [1, 3.5]);
});

test('a tap with no equivalent is reported rather than quietly dropped', () => {
  const { recipe, dropped } = recastShape(
    { video: 'x', shots: [{ screen: 'parties', duration: 2, actions: [
      { at: 0.5, do: 'tap', target: 'party-row-0' },
      { at: 1.2, do: 'tap', target: 'send-reminder-0' }
    ] }] },
    'laptop',
    CAT
  );
  const targets = recipe.shots[0].actions.map(a => a.target);
  assert.deepEqual(targets, ['party-row-0'], 'the row survives');
  assert.ok(dropped.some(d => d.includes('send-reminder-0')), dropped.join('; '));
});

test('asking for a phone takes a laptop shot list back to phone screens', () => {
  const { recipe } = recastShape(
    { video: 'x', shots: [
      { screen: 'mbb-desktop-items', duration: 2, actions: [{ at: 1, do: 'tap', target: 'create-item' }] },
      { screen: 'mcf-desktop', duration: 2, actions: [{ at: 1, do: 'tap', target: 'setup-automation' }] }
    ] },
    'phone',
    CAT
  );
  assert.deepEqual(recipe.shots.map(s => s.screen), ['items', 'mcf-parties']);
  assert.equal(recipe.shots[0].actions[0].target, 'create-new-item');
  assert.equal(recipe.shots[1].actions[0].target, 'setup-automation');
});

test('letting the script decide changes nothing at all', () => {
  for (const shape of ['', undefined, 'tablet']) {
    const { recipe, dropped } = recastShape(PHONE_RECIPE, shape, CAT);
    assert.deepEqual(recipe, PHONE_RECIPE);
    assert.deepEqual(dropped, []);
  }
});

test('every screen a recast can produce is one the renderer can draw', () => {
  /* A typo in either table would name a screen that does not exist, and the
     recipe would only fail at render time, after the studio had accepted it. */
  for (const screen of Object.keys(CAT)) {
    for (const shape of ['laptop', 'phone']) {
      assert.ok(CAT[screenOnShape(screen, shape)], `${screen} -> ${shape}`);
    }
  }
});

test('a recast recipe still passes the renderer\'s own validator', async () => {
  const { parse } = await import('../src/recipe.js');
  const { dump } = await import('js-yaml');
  const { recipe } = recastShape(PHONE_RECIPE, 'laptop', CAT);
  const { errors } = parse(dump(recipe), CAT, {});
  assert.equal(errors, undefined, JSON.stringify(errors));
});

test('every phone screen a laptop can show has a laptop screen to show it on', () => {
  /* The rule for these laptop screens is that only the interface changes, so a
     feature the phone has should not vanish when a script says "on a laptop".
     The ones left out are left out on purpose: Scan & Record is Mira's panel
     on the bill form rather than a screen, and WhatsApp itself is not a
     myBillBook screen in either shape. */
  const PHONE_ONLY = [
    'scan-bills', 'scan-camera', 'scan-reading', 'scan-done',
    'wa-attach', 'wa-chat', 'create-bill',
    'mcf-party', 'mcf-new-automation',
    /* A call is a call: these three are a phone ringing in somebody's hand,
         not a page of an app, so there is nothing for a laptop to show. */
      'mcf-tally', 'mcf-ai-call', 'mcf-ai-ringing', 'mcf-ai-noanswer',
    'create-purchase', 'invoice-created', 'create-invoice'
  ];
  const missing = [];
  for (const name of Object.keys(CAT)) {
    const screen = SCREENS[name];
    if (screen.device === 'desktop') continue;
    if (PHONE_ONLY.includes(name)) continue;
    if (screenOnShape(name, 'laptop') === name) missing.push(name);
  }
  assert.deepEqual(missing, [], 'these phone screens have no laptop version: ' + missing.join(', '));
});

test('Tally stays a desktop window whichever shape the reel is', () => {
  /* A phone reel that needs Tally cuts away to the computer - which is what
     actually happens, because Tally is not on the phone. So recasting must
     leave it alone in BOTH directions rather than hunting for a phone
     counterpart that cannot exist. */
  assert.equal(screenOnShape('tally-receivables', 'phone'), 'tally-receivables');
  assert.equal(screenOnShape('tally-receivables', 'laptop'), 'tally-receivables');
});

test('the myCashFlo process exists in both shapes', () => {
  /* A collections clip is a process, not a screen: what is stuck, who is
     worst, the automation set up, and the thing still running afterwards. The
     laptop had only the parties table, so a laptop clip had to start half way
     through its own story and stop before anything had been set up. */
  assert.equal(screenOnShape('mcf-dashboard', 'laptop'), 'mcf-desktop-dashboard');
  assert.equal(screenOnShape('mcf-parties', 'laptop'), 'mcf-desktop');
  assert.equal(screenOnShape('mcf-automations', 'laptop'), 'mcf-desktop-automations');

  /* and back the other way, so a laptop script recast to a phone lands on the
     page that matches rather than on the parties table every time */
  assert.equal(screenOnShape('mcf-desktop-dashboard', 'phone'), 'mcf-dashboard');
  assert.equal(screenOnShape('mcf-desktop-automations', 'phone'), 'mcf-automations');
});

test('adding a party, and theming a bill, work in both shapes', () => {
  /* Both were buttons with nothing behind them: "Create Party" on the parties
     screen in either shape, and the theme strip on the laptop's invoice. A
     clip could show the tap and then had nowhere to cut to. */
  assert.equal(screenOnShape('create-party', 'laptop'), 'mbb-desktop-create-party');
  assert.equal(screenOnShape('theme-store', 'laptop'), 'mbb-desktop-theme-store');
  assert.equal(screenOnShape('mbb-desktop-create-party', 'phone'), 'create-party');
  assert.equal(screenOnShape('mbb-desktop-theme-store', 'phone'), 'theme-store');
});
