/* Every tap target on every screen, against a real render.
 *
 * The studio draws the ring at a coordinate written in the screen file. It
 * does not look for the element - it cannot, because some targets never had
 * one - so a coordinate that stops matching the screen is a ring landing on
 * something else, and absolutely nothing says so. The clip renders, the tests
 * pass, and the footage shows a finger pressing a blank patch of a dialog.
 *
 * That has now happened enough times to be a category rather than a bug:
 * a share menu that closed under its own ring, a picker that covered the
 * button that opened it, Mira's panel rebuilt without its numbers, the theme
 * variants out by 117px, the Low Stock pill inheriting a coordinate from a
 * page where it is narrower. The first audit of all 260 of them found 36.
 *
 * So all of them are checked, every run, in the browser:
 *
 *   MISSING  - no element carries the id, so nothing can ever verify it and
 *              the coordinate is a guess maintained by hand.
 *   DRIFT    - the element is not where the screen says it is.
 *   COVERED  - something is on top of it at that point.
 *   OFFFRAME - it is outside the picture at this shape.
 *
 * audit-targets.mjs is the same code as a command, for when you want to read
 * the list rather than be told the count.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { auditTargets } from '../audit-targets.mjs';

/* A laptop's left rail is pushed out of a 9:16 frame on purpose - see the
 * camera note in screens/mbb-desktop-invoice.js. The rail's button is
 * therefore unreachable in a vertical video and perfectly reachable in a
 * square one, so it is not a defect; it is a thing to know before writing a
 * recipe that taps it. Listed here so that a NEW one still fails.
 *
 * If you are adding to this list, be sure it is the frame doing it and not a
 * coordinate that has wandered off the side of the screen. */
const CROPPED_BY_THE_FRAME = [
  'mbb-desktop-dashboard / create-sales-invoice',
  'mbb-desktop-invoice / create-sales-invoice',
  'mbb-desktop-items / create-sales-invoice',
  'mbb-desktop-low-stock / create-sales-invoice',
  'mbb-desktop-parties / create-sales-invoice',
  'mbb-desktop-reports / create-sales-invoice',
  'mbb-desktop-sales-list / create-sales-invoice',
  'mbb-desktop-scan / create-sales-invoice'
];

test('every tap target is where its screen says it is', async (t) => {
  t.diagnostic('this launches a browser and checks all of them; it is slow');

  const { findings, checked } = await auditTargets();
  assert.ok(checked > 200, `only ${checked} targets were checked - the audit found almost nothing to look at`);

  const named = f => `${f.screen} / ${f.target}`;
  const real = findings.filter(f =>
    f.kind !== 'OFFFRAME' || !CROPPED_BY_THE_FRAME.includes(named(f)));

  assert.deepEqual(
    real.map(f => `${f.kind}  ${named(f)} - ${f.note}`), [],
    'run `node audit-targets.mjs` to see these in full. A DRIFT is fixed by ' +
    'putting the measured number in the screen; a MISSING by giving the ' +
    'element an id and then measuring it; a COVERED by adding the tap to ' +
    'that screen\'s `dismisses`.'
  );

  /* The reverse: a screen that was fixed should not leave a name here
     forever, quietly excusing a real fault that turns up later under it. */
  const stillCropped = findings.filter(f => f.kind === 'OFFFRAME').map(named);
  for (const name of CROPPED_BY_THE_FRAME) {
    assert.ok(
      stillCropped.includes(name),
      `${name} is no longer outside the frame - take it out of CROPPED_BY_THE_FRAME`
    );
  }
});
