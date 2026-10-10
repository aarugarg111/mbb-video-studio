import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS } from '../screens/index.js';

/* Inside the SVG foreignObject the browser path parses screen markup as XML,
 * which knows five entity names and no others. An undefined one does not
 * degrade: it makes the whole document unparseable, so every frame of every
 * clip fails to decode, and the message names neither the character nor the
 * screen. The CLI path parses the same markup as HTML and never notices.
 *
 * web/lib/rasterise.ts converts them on the way through, so a slip here is no
 * longer fatal - but writing them is still writing something that means one
 * thing on one render path and nothing on the other. */

const XML_SAFE = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

const FIXTURE = {
  business: { name: 'BALAJI TRADING CO' },
  party: { name: 'Rakesh Kumar', balance: 6259 },
  items: [{ name: 'SUGAR 5KG', rate: 310, qty: 2, gst: 5, unit: 'PKT', stock: 4 }],
  invoice: { number: 29, date: '10/10/2026', theme: 'none' }
};

test('no screen writes an entity name that XML does not know', () => {
  const offenders = [];

  for (const [name, mod] of Object.entries(SCREENS)) {
    /* Both states, since a tap can reveal markup the default never shows. */
    for (const state of [{}, { lowStock: 1, paused: 1, selected: 1, batching: 1, sheet: 1, typed: 'x' }]) {
      const html = mod.render(FIXTURE, state);
      for (const [, entity] of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
        if (!XML_SAFE.has(entity)) offenders.push(`${name}: &${entity};`);
      }
    }
  }

  assert.deepEqual(
    [...new Set(offenders)],
    [],
    'use a numeric reference such as &#160; instead - it means the same thing on both render paths'
  );
});
