import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ASPECTS, DEFAULT_ASPECT, aspectNamed, aspectOf, stageAreaHeight,
  scaleFor, cssVarsFor, cssTextFor, PHONE_BOX, DESKTOP_BOX
} from '../src/aspect.js';
import { parse } from '../src/recipe.js';
import { catalogue, scrollables } from '../screens/index.js';
import { restingCamera, windowTransform } from '../src/camera.js';
import { SCREENS } from '../screens/index.js';

/* Three shapes of picture.
 *
 * The studio made one: 1080x1920, because that is what a Reel is. The same
 * clip gets posted to a feed and to YouTube, and re-cutting it afterwards
 * crops the middle of the picture - which is where the interface is.
 */

const LAPTOP = SCREENS['mbb-desktop-dashboard'];

test('a recipe that says nothing is still a Reel', () => {
  /* Every recipe written before there was a choice. */
  assert.equal(aspectOf({}).width, 1080);
  assert.equal(aspectOf({}).height, 1920);
  assert.equal(aspectOf(undefined), ASPECTS[DEFAULT_ASPECT]);
});

test('the three shapes are the three that were asked for', () => {
  assert.deepEqual(Object.keys(ASPECTS), ['9:16', '1:1', '16:9']);
  assert.deepEqual(
    Object.values(ASPECTS).map(a => `${a.width}x${a.height}`),
    ['1080x1920', '1080x1080', '1920x1080']
  );
});

test('a shape can be asked for in the words a person uses', () => {
  /* "1:1" is what a platform calls it; "square" is what a person calls it. */
  assert.equal(aspectNamed('square'), '1:1');
  assert.equal(aspectNamed('1:1'), '1:1');
  assert.equal(aspectNamed('horizontal'), '16:9');
  assert.equal(aspectNamed('landscape'), '16:9');
  assert.equal(aspectNamed('16x9'), '16:9');
  assert.equal(aspectNamed('16/9'), '16:9');
  assert.equal(aspectNamed('vertical'), '9:16');
  assert.equal(aspectNamed('Reel'), '9:16');
  assert.equal(aspectNamed('  SQUARE  '), '1:1', 'a pasted value brings case and whitespace');
  assert.equal(aspectNamed('round'), null, 'and anything else is not guessed at');
  assert.equal(aspectNamed(''), null);
});

test('a shape nobody renders is refused, with the choices named', () => {
  /* A misspelling must not pass: it renders a whole clip in the wrong shape,
     which looks like a finished video and is only wrong where it is posted. */
  const { errors } = parse(
    'video: t\naspect: portraitt\nshots: []\n', catalogue(), { scrollable: scrollables() }
  );
  assert.ok(errors, 'a misspelt shape must not render');
  assert.match(errors.join(' '), /portraitt/);
  for (const id of Object.keys(ASPECTS)) assert.match(errors.join(' '), new RegExp(id));
});

test('a shape a recipe does ask for is the shape it gets', () => {
  const shot = 'shots:\n  - screen: home\n    duration: 2\n';
  for (const [written, expected] of [['1:1', '1:1'], ['square', '1:1'], ['horizontal', '16:9']]) {
    const { recipe, errors } = parse(
      `video: t\naspect: "${written}"\n${shot}`, catalogue(), { scrollable: scrollables() }
    );
    assert.equal(errors, undefined, `"${written}" was refused`);
    assert.equal(recipe.aspect, expected);
  }
});

test('the brand strip never eats the picture', () => {
  for (const [shape, aspect] of Object.entries(ASPECTS)) {
    const area = stageAreaHeight(aspect);
    assert.ok(area > aspect.height * 0.8, `in ${shape} the strip takes more than a fifth`);
    assert.ok(aspect.logo < aspect.width, `in ${shape} the logo is wider than the picture`);
  }
});

test('a laptop rests pushed in only where there is something to fill', () => {
  /* A 16:9 window in a 9:16 picture is a band across the middle, so it is
     pushed in until its sides leave the frame. A 16:9 picture is the window's
     own shape - pushing in there would only crop it for nothing. */
  assert.ok(ASPECTS['9:16'].framing > 1, 'a Reel needs the shove');
  assert.equal(ASPECTS['16:9'].framing, 1, 'a widescreen does not');
  assert.equal(ASPECTS['1:1'].framing, 1, 'and a square is wide enough already');

  for (const aspect of Object.values(ASPECTS)) {
    assert.equal(restingCamera(LAPTOP, aspect).scale, aspect.framing);
  }
});

test('the camera is worked out in the shape it is filming', () => {
  /* The same window, the same shot, three shapes: the transform has to
     differ, or two of the three are composed for a picture they are not in. */
  const seen = new Set(
    Object.values(ASPECTS).map(a => windowTransform(LAPTOP, null, [], a))
  );
  assert.equal(seen.size, 3, 'two shapes came out with the same camera');

  for (const [shape, aspect] of Object.entries(ASPECTS)) {
    const t = windowTransform(LAPTOP, null, [], aspect);
    const drawn = Number(/scale\(([\d.]+)\)/.exec(t)[1]);
    assert.ok(
      Math.abs(drawn - scaleFor(aspect, 'desktop') * aspect.framing) < 0.001,
      `in ${shape} the window is drawn at ${drawn}`
    );
  }
});

test('nothing the camera does hangs below the picture', () => {
  /* The clamp uses the height of the area under the brand strip, and that
     height is the shape's. Reading the wrong one would slide the background
     into frame at a push-in - which is what it did when 1770 was a constant. */
  for (const [shape, aspect] of Object.entries(ASPECTS)) {
    for (const zoom of [null, { x: 100, y: 40, scale: 2 }, { x: 650, y: 380, scale: 3 }]) {
      const t = windowTransform(LAPTOP, zoom, [], aspect);
      const dy = Number(/translate\(-?[\d.]+px,\s*(-?[\d.]+)px/.exec(t)[1]);
      const half = stageAreaHeight(aspect) / 2
        / (scaleFor(aspect, 'desktop') * (zoom ? aspect.framing * zoom.scale : aspect.framing));
      assert.ok(
        Math.abs(dy) <= Math.max(0, DESKTOP_BOX.height / 2 - half) + 220,
        `in ${shape} the camera slid ${dy}px`
      );
    }
  }
});

test('the shape is handed to both renderers as the same properties', () => {
  /* The command line writes these onto the stage page and the browser writes
     them into the rasterised SVG's own style block. The same recipe has to
     give the same video either way, and nothing else would notice. */
  for (const aspect of Object.values(ASPECTS)) {
    const vars = cssVarsFor(aspect);
    assert.equal(vars['--frame-w'], `${aspect.width}px`);
    assert.equal(vars['--frame-h'], `${aspect.height}px`);
    assert.equal(vars['--phone-scale'], String(aspect.phone));
    assert.equal(vars['--desktop-scale'], String(aspect.desktop));

    const text = cssTextFor(aspect);
    for (const [name, value] of Object.entries(vars)) {
      assert.ok(text.includes(`${name}: ${value};`), `${name} is missing from the CSS`);
    }
  }
});

test('every property the stage reads is one the shape sets', async () => {
  /* A rule reading a property nothing sets falls back to the literal in its
     own default - which is the vertical one, in every shape. It would look
     right in a Reel and wrong in the other two, and only in one renderer. */
  const files = ['../stage/index.html', '../kit/kit.css', '../web/lib/stage-css.ts',
                 '../web/app/globals.css'];
  const set = new Set(Object.keys(cssVarsFor(ASPECTS[DEFAULT_ASPECT])));

  for (const file of files) {
    const src = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const [, name] of src.matchAll(/var\((--(?:frame|band|phone-scale|desktop-scale|endcard)[\w-]*)/g)) {
      assert.ok(set.has(name), `${file} reads ${name}, which no shape sets`);
    }
  }
});

test('the boxes the scales were chosen against are the real ones', () => {
  /* PHONE_BOX and DESKTOP_BOX are the devices plus their own chrome. If the
     phone's padding or the window's title bar changes, every scale above was
     chosen against the wrong number. */
  assert.equal(PHONE_BOX.width, 390 + 11 * 2, 'the phone body padding moved');
  assert.equal(PHONE_BOX.height, 844 + 11 * 2);
  assert.equal(DESKTOP_BOX.width, 720 + 8 * 2, 'the window margin moved');
  assert.equal(DESKTOP_BOX.height, 405 + 30 + 8, 'the title bar or the window padding moved');
});
