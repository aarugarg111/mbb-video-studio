import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCREENS, catalogue } from '../screens/index.js';
import { deviceOf, viewportFor, urlFor, DEVICES } from '../src/device.js';

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
    ['mbb-desktop-create-invoice', 'mbb-desktop-items', 'mbb-desktop-parties', 'mcf-desktop'],
    'only the screens that asked for it are desktop screens'
  );
});

test('a desktop screen carries the address its browser shows', () => {
  assert.equal(urlFor(SCREENS['mcf-desktop']), 'app.mycashflo.in/parties');
  assert.equal(urlFor({}), 'mybillbook.in', 'and there is always something to show');
});

test('both shapes fill the same width, so text is the same size in either', () => {
  for (const [name, d] of Object.entries(DEVICES)) {
    assert.ok(d.width * d.scale <= 1080, `${name} is wider than the frame`);
    assert.ok(d.height * d.scale <= 1770, `${name} is taller than the space under the logo`);
  }
  /* The point of the two scales: a desktop screen holds more, drawn no
     smaller. Within a few per cent of the same width is what makes that true. */
  const widths = Object.values(DEVICES).map(d => d.width * d.scale);
  assert.ok(Math.max(...widths) - Math.min(...widths) < 400);
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
    assert.ok(src.includes('width: 720px'), `${file} draws the desktop at another width`);
    assert.ok(src.includes('height: 540px'), `${file} draws the desktop at another height`);
    assert.ok(src.includes('scale(1.5)'), `${file} scales the desktop differently`);
  }
});

test('the desktop screen renders with nothing at all', () => {
  assert.ok(SCREENS['mcf-desktop'].render({}, {}).includes('class="screen dkscreen"'));
});

test('the follow-up sheet is there only once it is opened', () => {
  const closed = SCREENS['mcf-desktop'].render({}, {});
  const open = SCREENS['mcf-desktop'].render({}, { sheet: 1 });
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
    assert.equal(html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/), null);
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
  assert.ok(inlined.includes('width: 720px'), 'the inlined desktop is another width');
  assert.ok(inlined.includes('height: 540px'), 'the inlined desktop is another height');
  assert.ok(inlined.includes('scale(1.5)'), 'the inlined desktop is another scale');
});
