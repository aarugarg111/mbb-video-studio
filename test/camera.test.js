import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS } from '../screens/index.js';
import { restingCamera, cameraAt, innerTransform, windowTransform } from '../src/camera.js';
import { DEVICES } from '../src/device.js';
import { ASPECTS, DEFAULT_ASPECT } from '../src/aspect.js';

/* The shape these were written against. The camera takes the shape now - a
   16:9 window needs a shove to fill a Reel and none to fill a widescreen -
   and these are about the Reel. test/aspect.test.js covers the other two. */
const VERTICAL = ASPECTS[DEFAULT_ASPECT];

/* A 16:9 window inside a 9:16 video is a band across the middle of the
 * picture. Pushing in INSIDE that band - which is what a phone zoom does -
 * magnifies the content and leaves the band the same size, so the laptop clips
 * stayed small however far the camera went. These cover the camera that moves
 * the window itself. */

const PHONE = SCREENS.home;
const LAPTOP = SCREENS['mbb-desktop-parties'];

test('a phone has no resting camera - it already fills the picture', () => {
  assert.equal(restingCamera(PHONE), null);
  assert.equal(windowTransform(PHONE, null), null);
});

test('a laptop rests pushed in, so no shot is a small band in the middle', () => {
  const resting = restingCamera(LAPTOP);
  assert.ok(resting.scale > 1, 'the window should start larger than the frame');
  assert.equal(resting.scale, VERTICAL.framing);
  assert.ok(windowTransform(LAPTOP, null).includes('scale('));
});

test('the whole width of a page stays in frame at rest', () => {
  /* The page draws its content between the rail and its own right padding. If
     the crop were tighter than that, a laptop clip would lose the column the
     video is about - which is how it lost the Balance column. */
  const box = DEVICES.desktop;
  const visible = box.width / VERTICAL.framing;
  const rail = 126;
  const padding = 13;
  assert.ok(
    visible >= box.width - rail - padding * 2,
    `the crop shows ${visible.toFixed(0)}px of a ${box.width - rail - padding * 2}px page`
  );
});

test('a laptop screen names the point the camera sits on', () => {
  for (const name of Object.keys(SCREENS)) {
    const screen = SCREENS[name];
    if (screen.device !== 'desktop') continue;
    assert.ok(screen.focus, `${name} has no focus point`);
    assert.ok(screen.focus.x > 0 && screen.focus.x < DEVICES.desktop.width, name);
  }
});

test('a shot that zooms goes closer than the resting camera, not back out', () => {
  const resting = restingCamera(LAPTOP);
  const asked = { x: 300, y: 200, scale: 2 };
  assert.equal(cameraAt(LAPTOP, asked).scale, resting.scale * 2);
  assert.equal(cameraAt(LAPTOP, asked).x, 300);
});

test('the camera never shows past the edges of the window', () => {
  /* Without this a push-in near a corner slides the background into frame
     beside the page. */
  const box = DEVICES.desktop;
  for (const x of [0, 50, box.width / 2, box.width - 10, box.width]) {
    const t = windowTransform(LAPTOP, { x, y: 10, scale: 2.5 });
    const dx = Number(/translate\((-?[\d.]+)px/.exec(t)[1]);
    const halfW = box.width / 2 / (VERTICAL.framing * 2.5);
    assert.ok(Math.abs(dx) <= box.width / 2 - halfW + 0.01, `x=${x} pans past the edge (${dx})`);
  }
});

test('a phone zoom still moves the layers and not the phone', () => {
  const t = innerTransform(PHONE, { x: 100, y: 200, scale: 2 });
  assert.ok(t.includes('scale(2'), t);
  assert.equal(windowTransform(PHONE, { x: 100, y: 200, scale: 2 }), null);
});

test('a laptop zoom moves the window and not the layers', () => {
  assert.equal(innerTransform(LAPTOP, { x: 100, y: 200, scale: 2 }), null);
  assert.ok(windowTransform(LAPTOP, { x: 100, y: 200, scale: 2 }).includes('scale('));
});

test('both renderers ask the same module where the camera is', async () => {
  /* The maths was written out twice before, which is how the browser and the
     command line came to disagree about what a frame looked like. */
  const { readFile } = await import('node:fs/promises');
  for (const path of ['stage/stage.js', 'web/lib/render.ts']) {
    const src = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    assert.ok(src.includes('innerTransform'), `${path} works the camera out itself`);
    assert.ok(src.includes('windowTransform'), `${path} works the camera out itself`);
  }
});

test('the camera holds whatever the shot taps', () => {
  /* The rail's Create Sales Invoice button sits at x=63, outside the band the
     camera rests on, so the tap that starts a laptop bill happened off screen.
     A shot that taps it should bring it into frame. */
  const box = DEVICES.desktop;
  const rail = { x: 63, y: 46 };
  const held = windowTransform(LAPTOP, null, [rail]);
  const dx = Number(/translate\((-?[\d.]+)px/.exec(held)[1]);
  const halfW = box.width / 2 / VERTICAL.framing;
  /* Where the band sits after the pan, in the screen's own pixels. */
  const centre = box.width / 2 - dx;
  assert.ok(rail.x >= centre - halfW && rail.x <= centre + halfW,
    `the tap at ${rail.x} is outside ${(centre - halfW).toFixed(0)}..${(centre + halfW).toFixed(0)}`);
});

test('a shot that taps nothing out of frame does not move', () => {
  const still = windowTransform(LAPTOP, null, [{ x: 423, y: 200 }]);
  assert.equal(still, windowTransform(LAPTOP, null, []));
});

test('the pan still never shows past the window edges', () => {
  const box = DEVICES.desktop;
  for (const x of [0, 5, box.width - 5, box.width]) {
    const t = windowTransform(LAPTOP, null, [{ x, y: 100 }]);
    const dx = Number(/translate\((-?[\d.]+)px/.exec(t)[1]);
    const halfW = box.width / 2 / VERTICAL.framing;
    assert.ok(Math.abs(dx) <= box.width / 2 - halfW + 0.01, `tap at ${x} pans past the edge`);
  }
});
