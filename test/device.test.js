import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawColoursIn } from '../src/colour-guard.js';
import { readFile } from 'node:fs/promises';
import { SCREENS, catalogue } from '../screens/index.js';
import { deviceOf, viewportFor, urlFor, chromeOf, titleFor, DEVICES } from '../src/device.js';
import { ASPECTS, PHONE_BOX, DESKTOP_BOX, scaleFor, stageAreaHeight } from '../src/aspect.js';

test('a screen that says nothing is a phone screen', () => {
  assert.equal(deviceOf(SCREENS.home), 'phone');
  assert.equal(deviceOf({}), 'phone');
  assert.equal(deviceOf(undefined), 'phone');
  assert.deepEqual(viewportFor(SCREENS.home), DEVICES.phone);
});

test('a screen that says desktop is drawn as one', () => {
  assert.equal(deviceOf(SCREENS['mcf-desktop']), 'desktop');
  assert.deepEqual(viewportFor(SCREENS['mcf-desktop']), DEVICES.desktop);
});

test('a shape nobody has heard of falls back to the phone', () => {
  /* A typo must not produce a frame of nothing. */
  assert.equal(deviceOf({ device: 'tablet' }), 'phone');
});

test('every screen built before this one is unchanged', () => {
  const desktop = Object.keys(catalogue()).filter(n => deviceOf(SCREENS[n]) === 'desktop');
  assert.deepEqual(
    desktop.sort(),
    [
      'mbb-desktop-create-invoice', 'mbb-desktop-create-item', 'mbb-desktop-create-party',
      'mbb-desktop-dashboard', 'mbb-desktop-invoice',
      'mbb-desktop-items', 'mbb-desktop-parties', 'mbb-desktop-purchase',
      'mbb-desktop-reports', 'mbb-desktop-sales-list',
      'mbb-desktop-scan', 'mbb-desktop-scan-done', 'mbb-desktop-scan-reading',
      'mbb-desktop-theme-store',
      'mcf-desktop', 'mcf-desktop-automations', 'mcf-desktop-dashboard',
      'mcf-desktop-history',
      'tally-receivables'
    ],
    'only the screens that asked for it are desktop screens'
  );
});

test('a desktop screen carries the address its browser shows', () => {
  assert.equal(urlFor(SCREENS['mcf-desktop']), 'app.mycashflo.in/parties');
  assert.equal(urlFor({}), 'mybillbook.in', 'and there is always something to show');
});

test('both devices fit inside every shape of picture', () => {
  /* The scales used to live on the device, which meant one pair of numbers,
     chosen for a vertical video. A square is a third of the height, so a
     phone drawn at the Reel's size would have hung off the bottom of it -
     and nothing would have failed, because a frame that is wrong is still a
     frame. */
  for (const [shape, aspect] of Object.entries(ASPECTS)) {
    for (const name of Object.keys(DEVICES)) {
      const scale = scaleFor(aspect, name);
      /* The phone body and the laptop window carry their own chrome, and it
         is drawn too - see PHONE_BOX and DESKTOP_BOX. */
      const box = name === 'desktop' ? DESKTOP_BOX : PHONE_BOX;
      /* The laptop window is ALLOWED to be wider than the picture - its
         sides go out of frame the way a screen recording's do, which is the
         whole point of the resting push-in. The phone is not: a phone with
         its edges cut off is not a phone, it is a mistake. */
      if (name !== 'desktop') {
        assert.ok(box.width * scale <= aspect.width + 1,
          `in ${shape} the ${name} is ${Math.round(box.width * scale)}px wide `
          + `in a ${aspect.width}px picture`);
      }
      /* Height is not negotiable for either. Nothing may hang below the
         picture, because there is no "out of frame" that reads as deliberate
         at the bottom of a window. */
      assert.ok(box.height * scale <= stageAreaHeight(aspect) + 1,
        `in ${shape} the ${name} is ${Math.round(box.height * scale)}px tall `
        + `in the ${stageAreaHeight(aspect)}px under the brand strip`);
    }
  }
});

test('a laptop window is drawn large enough to read in every shape', () => {
  /* Why the laptop has a scale of its own at all: a real window shrunk to
     fit puts its text at about four pixels. Counting the resting push-in, it
     has to fill most of the picture's width in every shape. */
  for (const [shape, aspect] of Object.entries(ASPECTS)) {
    const drawn = DESKTOP_BOX.width * scaleFor(aspect, 'desktop') * aspect.framing;
    assert.ok(drawn >= aspect.width * 0.75,
      `in ${shape} the laptop fills only ${Math.round(100 * drawn / aspect.width)}% of the width`);
  }
});

test('both renderers draw the same two frames', async () => {
  /* stage/index.html serves the command line and stage.tsx the browser. A
     frame in one and not the other means the same recipe produces two
     different videos - and nothing else would notice. */
  const cli = await readFile(new URL('../stage/index.html', import.meta.url), 'utf8');
  const web = await readFile(new URL('../web/app/studio/stage.tsx', import.meta.url), 'utf8');

  for (const [file, src] of [['stage/index.html', cli], ['stage.tsx', web]]) {
    assert.ok(/viewport/.test(src), `${file} has no phone viewport`);
    assert.ok(/desktop-viewport/.test(src), `${file} has no desktop viewport`);
    assert.ok(/desktop-url/.test(src), `${file} has no address bar`);
  }

  /* And at the same size, or the two renders differ by a scale factor. */
  const css = await readFile(new URL('../web/app/globals.css', import.meta.url), 'utf8');
  for (const [file, src] of [['stage/index.html', cli], ['globals.css', css]]) {
    /* Read off DEVICES rather than typed out again: these were three literals
       that had to be edited in step with src/device.js, and the day the window
       changed shape they failed for being out of date rather than for anything
       being wrong. */
    assert.ok(src.includes(`width: ${DEVICES.desktop.width}px`), `${file} draws the desktop at another width`);
    assert.ok(src.includes(`height: ${DEVICES.desktop.height}px`), `${file} draws the desktop at another height`);
    /* Both now scale from the same custom property rather than a literal,
       because how big a window is drawn depends on the shape of the picture.
       The property NAME is what has to match: two files reading different
       names is the same bug as two files holding different numbers. */
    assert.ok(src.includes('scale(var(--desktop-scale'), `${file} scales the desktop from somewhere else`);
    assert.ok(src.includes('scale(var(--phone-scale'), `${file} scales the phone from somewhere else`);
  }
});

test('the desktop screen renders with nothing at all', () => {
  assert.ok(SCREENS['mcf-desktop'].render({}, {}).includes('class="screen dkscreen"'));
});

test('the follow-up sheet is there only once it is opened', () => {
  const closed = SCREENS['mcf-desktop'].render({}, {});
  const open = SCREENS['mcf-desktop'].render({}, { followup: 1 });
  assert.ok(!closed.includes('New Call Follow-Up'));
  assert.ok(open.includes('New Call Follow-Up'));
  assert.ok(open.includes('Step 1 of 2'));
});

test('the AI bar carries an instruction in the owner own words', () => {
  const html = SCREENS['mcf-desktop'].render({}, {});
  assert.ok(html.includes('Talk to AI Accountant'));
  assert.ok(html.includes('calling start karo'), 'the instruction is the point of that bar');
});

test('the desktop screen emits no raw colour and no awkward entity', () => {
  for (const state of [{}, { sheet: 1, asking: 1 }]) {
    const html = SCREENS['mcf-desktop'].render({ party: { name: 'X', balance: 1 } }, state);
    assert.deepEqual(rawColoursIn(html), []);
    for (const [, e] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
      assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(e), `&${e};`);
    }
  }
});

test('a party name that would break the markup is escaped', () => {
  const html = SCREENS['mcf-desktop'].render({ party: { name: '<script>x</script>', balance: 1 } }, {});
  assert.ok(!html.includes('<script>'));
});

test('the CSS handed to the rasteriser describes both frames', async () => {
  /* The browser render is a separate document that sees ONLY the CSS given to
     it - globals.css is not part of that. The first desktop render came out
     as an empty phone because this copy knew about one frame and the page knew
     about two. Nothing failed; the video was simply wrong. */
  const inlined = await readFile(new URL('../web/lib/stage-css.ts', import.meta.url), 'utf8');

  for (const rule of [
    '.stage-desktop',
    '#stage-desktop-viewport',
    '#stage-desktop-url',
    '.stage-phone.hidden'
  ]) {
    assert.ok(inlined.includes(rule), `the rasteriser is never told about ${rule}`);
  }

  /* And at the same size as everywhere else. */
  assert.ok(inlined.includes(`width: ${DEVICES.desktop.width}px`), 'the inlined desktop is another width');
  assert.ok(inlined.includes(`height: ${DEVICES.desktop.height}px`), 'the inlined desktop is another height');
  assert.ok(inlined.includes('scale(var(--desktop-scale'), 'the inlined desktop is scaled from somewhere else');
});

test('Tally is a desktop program, and is never drawn as a web page', () => {
  /* Tally runs on the owner's Windows machine. It was a phone screen for a
     while, which put a Windows accounting program on a mobile it has never
     shipped on, and drawing it in the laptop's browser frame would have put a
     myBillBook address on somebody else's software. Both are claims an ad
     should not make. */
  assert.equal(deviceOf(SCREENS['tally-receivables']), 'desktop');
  assert.equal(chromeOf(SCREENS['tally-receivables']), 'app');
  assert.equal(titleFor(SCREENS['tally-receivables']), 'TallyPrime');
});

test('every other desktop screen is still a browser with an address', () => {
  for (const name of Object.keys(catalogue())) {
    const screen = SCREENS[name];
    if (deviceOf(screen) !== 'desktop' || name === 'tally-receivables') continue;
    assert.equal(chromeOf(screen), 'browser', name + ' stopped being a browser window');
    assert.ok(urlFor(screen).length > 0, name + ' has no address to show');
  }
});

test('both renderers draw the title bar the same way', async () => {
  /* The pair that has silently disagreed before: one renderer showing Tally
     with a title bar and the other with "mybillbook.in" in an address pill
     would be two different videos from one recipe. */
  const cli = await readFile(new URL('../stage/stage.js', import.meta.url), 'utf8');
  const web = await readFile(new URL('../web/lib/render.ts', import.meta.url), 'utf8');
  for (const [file, src] of [['stage.js', cli], ['render.ts', web]]) {
    assert.ok(/chromeOf/.test(src), file + ' never asks what kind of window this is');
    assert.ok(/titleFor/.test(src), file + ' never shows a program title');
    assert.ok(src.includes("classList.toggle('app'"), file + ' never switches the bar over');
  }
});
