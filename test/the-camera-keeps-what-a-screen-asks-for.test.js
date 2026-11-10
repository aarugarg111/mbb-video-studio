/* `focus.fit`: the promise that a named stretch of a laptop screen stays on
 * camera, however far the shot zooms.
 *
 * The fault this answers looked like two faults and was one. A laptop window
 * is pushed in until it fills a Reel, and a shot's zoom multiplies THAT, so
 * the studio's own guidance - "2 to 2.5 reads well" - meant up to 3.2x on a
 * laptop. That guidance was written for phones, where a zoom cannot crop
 * anything that matters. On a wide table it cropped away the thing it was
 * zooming TO: the Profit and Loss report, zoomed at Net Profit, showed
 * neither the words "Net Profit" nor the end of the figure.
 *
 * So the cap is not in the recipe and not in the prompt - either would have
 * to be got right again every time a model writes a shot. It is on the
 * SCREEN, which is the thing that knows how wide its own content is.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS } from '../screens/index.js';
import { restingCamera, cameraAt, maxScale, fitBand, windowTransform } from '../src/camera.js';
import { ASPECTS, scaleFor } from '../src/aspect.js';
import { viewportFor } from '../src/device.js';

const REPORT = SCREENS['mbb-desktop-reports'];
const LIST = SCREENS['mbb-desktop-report-list'];
/* A laptop screen that asks for nothing, to prove the cap stays out of the
   way of every screen that has not opted in. */
const PLAIN = SCREENS['mbb-desktop-invoice'];

/* How much of the screen's own width is across the picture at this scale. */
const visibleWidth = (aspect, scale) => aspect.width / (scaleFor(aspect, 'desktop') * scale);

test('a screen that asks for nothing is framed exactly as it always was', () => {
  assert.equal(fitBand(PLAIN), null, 'this screen is the control - it must not opt in');
  for (const [name, aspect] of Object.entries(ASPECTS)) {
    assert.equal(maxScale(PLAIN, aspect), Infinity, `${name} caps a screen that asked for no cap`);
    assert.equal(
      restingCamera(PLAIN, aspect).scale, aspect.framing,
      `${name} moved the resting camera of a screen that asked for nothing`
    );
    /* And a zoom still multiplies, which is the whole point of a zoom. */
    assert.equal(
      cameraAt(PLAIN, { x: 300, y: 200, scale: 2.2 }, aspect).scale,
      aspect.framing * 2.2, `${name} capped an uncapped screen's zoom`
    );
  }
});

test('the report keeps its whole table on camera however hard a shot zooms', () => {
  const band = fitBand(REPORT);
  assert.ok(band, 'the report opted in');

  for (const [name, aspect] of Object.entries(ASPECTS)) {
    for (const asked of [1.2, 2, 2.5, 4]) {
      const camera = cameraAt(REPORT, { x: band.hi, y: 380, scale: asked }, aspect);
      const seen = visibleWidth(aspect, camera.scale);
      assert.ok(
        seen >= band.width - 0.01,
        `${name}: a zoom to ${asked} left ${seen.toFixed(0)}px of the screen on ` +
        `camera, and the table needs ${band.width}`
      );
    }
  }
});

test('and it keeps the RIGHT part - a zoom at one cell does not slide the names off', () => {
  /* The cap alone is not enough: holding 440px while centred on the figures
     showed 440px of the wrong end, with every row's name cut off the front.
     This is the half that was missing. */
  const band = fitBand(REPORT);
  const box = viewportFor(REPORT);

  for (const [name, aspect] of Object.entries(ASPECTS)) {
    /* Zoomed hard at the far right of the band, which is where a Net Profit
       zoom goes. */
    const zoom = { x: band.hi, y: 380, scale: 4 };
    const camera = cameraAt(REPORT, zoom, aspect);
    const transform = windowTransform(REPORT, zoom, [], aspect);
    const dx = Number(/translate\((-?[\d.]+)px/.exec(transform)[1]);

    /* dx is how far the window is pushed from centred, in screen pixels. */
    const centre = box.width / 2 - dx;
    const half = visibleWidth(aspect, camera.scale) / 2;
    assert.ok(
      centre - half <= band.lo + 0.01 && centre + half >= band.hi - 0.01,
      `${name}: the camera sat on ${(centre - half).toFixed(0)}..${(centre + half).toFixed(0)} ` +
      `and the table is ${band.lo}..${band.hi}`
    );
  }
});

test('the report LIST asks for the whole window, and so is never cropped', () => {
  const band = fitBand(LIST);
  assert.equal(band.width, 736, 'the whole window, chrome included');

  for (const [name, aspect] of Object.entries(ASPECTS)) {
    const seen = visibleWidth(aspect, restingCamera(LIST, aspect).scale);
    assert.ok(
      seen >= band.width - 0.01,
      `${name}: ${seen.toFixed(0)}px of the window is on camera at rest, out of ${band.width}`
    );
  }
});

test('asking for the whole window never pushes IN past what the shape wanted', () => {
  /* "Whole" is a promise not to crop, not a licence to magnify. In a square
     and a widescreen the window already fits, and this must leave them
     alone rather than blowing them up to the frame's width. */
  for (const [name, aspect] of Object.entries(ASPECTS)) {
    assert.ok(
      restingCamera(LIST, aspect).scale <= aspect.framing + 0.001,
      `${name} pushed in on a screen that only asked not to be cropped`
    );
  }
});
