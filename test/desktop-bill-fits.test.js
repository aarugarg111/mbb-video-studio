import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import * as invoice from '../screens/mbb-desktop-invoice.js';
import { stateAt } from '../src/timeline.js';

/* The bill on a laptop is a whole bill.
 *
 * It is the phone's own markup at the phone's own width, drawn into a pane
 * that is shorter than the document is tall. At a fixed 0.7 it ran off the
 * bottom: the clip ended on a sheet cut through its own total, the one thing
 * a billing video must not do. Nothing failed - a frame that is wrong is
 * still a frame - so Aryan found it by looking at it.
 *
 * The scale is worked out from how long the bill is now, from numbers
 * measured off a render. Those numbers are the part that rots: a change to
 * the bill's markup or to the pane moves them and nothing on screen says so.
 * This measures them again, in a real browser, against the real screen.
 */

const PANE_TOP = 115;      /* where the sheet starts, inside the pane */
const PANE_BOTTOM = 394;   /* where the pane ends                     */

const data = n => ({
  business: { name: 'SAGAR SUPERBAZAAR' },
  party: { name: 'ASHOK TRADING CO', address: 'Sadar Bazaar, Agra' },
  invoice: { number: 5945 },
  items: Array.from({ length: n }, (_, i) => ({
    name: `ITEM NUMBER ${i + 1}`, rate: 310, qty: 2, gst: 5, unit: 'PKT'
  }))
});

/* The screen in its own 720x405 window, as the renderer draws it. */
async function boxes(page, css, items) {
  await page.setContent(`<style>${css}
    body { margin: 0 }
    #vp { position: relative; width: 720px; height: 405px; overflow: hidden }</style>
    <div id="vp">${invoice.render(data(items), {})}</div>`);
  return page.$eval('.mb-paper-fit', el => {
    const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
  });
}

test('the whole bill fits the pane, however long the bill is', async (t) => {
  t.diagnostic('this launches a browser');

  const css = (await readFile(new URL('../kit/tokens.css', import.meta.url), 'utf8'))
    + (await readFile(new URL('../kit/kit.css', import.meta.url), 'utf8'));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    /* One item is the shortest bill a recipe can film; eight is longer than
       any recipe has, which is the point of trying it. */
    for (const items of [1, 2, 3, 5, 8]) {
      const box = await boxes(page, css, items);
      assert.ok(
        box.bottom <= PANE_BOTTOM + 1,
        `a ${items}-item bill runs ${Math.round(box.bottom - PANE_BOTTOM)}px past the pane`
      );
      assert.ok(box.top >= PANE_TOP - 1, `a ${items}-item bill starts above the pane`);
      /* Fitted, not shrunk to nothing: it still has to read as a document. */
      assert.ok(box.bottom - box.top > 190, `a ${items}-item bill is too small to be a bill`);
    }
  } finally {
    await browser.close();
  }
});

test('the measurements the scale is built on still hold', async (t) => {
  t.diagnostic('this launches a browser');

  const css = (await readFile(new URL('../kit/tokens.css', import.meta.url), 'utf8'))
    + (await readFile(new URL('../kit/kit.css', import.meta.url), 'utf8'));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    /* The sheet's own height: a fixed head and foot plus a row per item.
       billScale() is built on exactly that shape, so if the bill stops being
       a straight line in the number of items the scale stops being right. */
    const heights = [];
    for (const n of [1, 2, 3, 5, 8]) {
      const box = await boxes(page, css, n);
      heights.push((box.bottom - box.top) / invoice.billScale(data(n)));
    }
    const step = (heights.at(-1) - heights[0]) / 7;
    for (const [i, n] of [1, 2, 3, 5, 8].entries()) {
      const predicted = heights[0] + step * (n - 1);
      assert.ok(
        Math.abs(heights[i] - predicted) < 3,
        `a ${n}-item bill is ${Math.round(heights[i])}px, not the ${Math.round(predicted)}px `
        + 'a fixed head plus a row per item predicts - billScale() is guessing'
      );
    }

    /* And the pane it is fitted into is where it was measured. */
    const pane = await page.$eval('.mb-paper', el => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, centreX: (b.left + b.right) / 2 };
    });
    assert.ok(Math.abs(pane.bottom - PANE_BOTTOM) < 2, `the pane now ends at ${pane.bottom}`);
    assert.ok(Math.abs(pane.centreX - 318) < 2, `the pane centre moved to ${pane.centreX}`);
  } finally {
    await browser.close();
  }
});

test('a place on the bill moves with the bill', () => {
  /* The seven zoom points were measured at 0.7. A longer bill is drawn
     smaller, so they all have to move - otherwise a recipe asking to look at
     the customer's number gets a close-up of empty paper. */
  const short = invoice.zoomPointsFor(data(1));
  const long = invoice.zoomPointsFor(data(8));

  assert.ok(invoice.billScale(data(8)) < invoice.billScale(data(1)), 'a longer bill is smaller');
  assert.ok(long.totals.y < short.totals.y, 'the total on a longer bill sits higher up');

  /* The sheet scales about the top of the pane, so nothing climbs above it. */
  for (const [name, p] of Object.entries(long)) {
    assert.ok(p.y >= PANE_TOP - 1, `${name} ended up above the pane`);
    assert.ok(p.y <= PANE_BOTTOM + 1, `${name} ended up below the pane`);
  }

  /* Every name the screen offers is still offered. */
  assert.deepEqual(Object.keys(long).sort(), Object.keys(invoice.zoomPoints).sort());
});

test('the camera is told where the bill actually is', () => {
  /* The whole point: stateAt has to use the moved places, not the table. */
  const recipe = {
    ...data(8),
    video: 'bill-fit',
    shots: [{
      screen: 'mbb-desktop-invoice',
      duration: 4,
      actions: [{ at: 0.5, do: 'zoom', target: 'totals', to: 2 }]
    }]
  };

  const moved = invoice.zoomPointsFor(recipe).totals;
  const at = stateAt(recipe, 3.5).zoom;
  assert.ok(at, 'the zoom never happened');
  assert.ok(Math.abs(at.y - moved.y) < 1, `the camera looked at ${at.y}, the total is at ${moved.y}`);
  assert.ok(
    Math.abs(at.y - invoice.zoomPoints.totals.y) > 1,
    'the camera used the table, so an eight-item bill zooms onto the wrong place'
  );
});
