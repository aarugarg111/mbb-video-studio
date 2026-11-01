import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { isLow, lowStockItems, DEFAULT_LOW_AT } from '../screens/items.js';
import { stateAt } from '../src/timeline.js';
import { parse } from '../src/recipe.js';

const ITEMS = [
  { name: 'CEMENT OPC 50KG', rate: 410, stock: 6, lowAt: 10, unit: 'BAG' },
  { name: 'TMT BAR 8MM', rate: 7792, stock: 2, lowAt: 5, unit: 'BUNDLE' },
  { name: 'WHITE CEMENT 5KG', rate: 290, stock: 48, lowAt: 10, unit: 'PKT' },
  { name: 'WALL PUTTY 20KG', rate: 640, stock: 9, lowAt: 12, unit: 'BAG' }
];
const DATA = { business: { name: 'Balaji Trading Co' }, items: ITEMS };

test('an item is low against its own level, or ten without one', () => {
  assert.equal(isLow({ stock: 6, lowAt: 10 }), true);
  assert.equal(isLow({ stock: 11, lowAt: 10 }), false);
  assert.equal(isLow({ stock: 10, lowAt: 10 }), true, 'at the level counts as low');
  assert.equal(isLow({ stock: DEFAULT_LOW_AT }), true, 'no lowAt falls back to ten');
  assert.equal(isLow({ stock: DEFAULT_LOW_AT + 1 }), false);
  assert.equal(isLow({ stock: -496 }), true, 'the app lists negative stock as low');
});

test('an item with no stock at all is not treated as low', () => {
  /* items.js already assumes 90 where a recipe says nothing; a script that
   * never mentions stock should not suddenly be about running out. */
  assert.equal(isLow({ name: 'X', rate: 10 }), false);
});

test('the filter keeps only what is running low', () => {
  assert.deepEqual(lowStockItems(ITEMS).map(i => i.name),
    ['CEMENT OPC 50KG', 'TMT BAR 8MM', 'WALL PUTTY 20KG']);
});

test('the unfiltered list shows everything', () => {
  const html = SCREENS.items.render(DATA, {});
  for (const i of ITEMS) assert.ok(html.includes(i.name), i.name);
});

test('the filtered list drops what is well stocked', () => {
  const html = SCREENS.items.render(DATA, { lowStock: 1 });
  assert.ok(!html.includes('WHITE CEMENT 5KG'), 'a well-stocked item must not survive the filter');
  assert.ok(html.includes('CEMENT OPC 50KG'));
});

test('a low quantity is red, filtered or not', () => {
  /* reference/frames/item-low.png: the app prints a low quantity in red. */
  for (const state of [{}, { lowStock: 1 }]) {
    const html = SCREENS.items.render(DATA, state);
    assert.match(html, /class="q low"/);
  }
});

test('a well-stocked quantity is not red', () => {
  /* Scoped to this item's own row. The page fills its remaining rows from
     the shop's shelf, and a real shelf HAS low items on it - so asking the
     whole page to contain no red stopped being a question about this item. */
  const html = SCREENS.items.render({ items: [{ name: 'WELL STOCKED', rate: 1, stock: 90 }] }, {});
  /* Cut from this row's id to the next one's, which is this row and nothing
     else - no regex, because the markup nests and a lazy match would stop at
     the first closing tag inside it. */
  const from = html.indexOf('id="item-row-0"');
  const to = html.indexOf('id="item-row-1"');
  assert.ok(from > -1 && to > from, 'the page did not draw two rows');
  const row = html.slice(from, to);

  assert.match(row, /WELL STOCKED/, 'the first row is not the recipe own item');
  assert.doesNotMatch(row, /class="q low"/);
});

test('the pill is plain until it is tapped, then selected and clearable', () => {
  assert.doesNotMatch(SCREENS.items.render(DATA, {}), /class="fp sel"/);
  const on = SCREENS.items.render(DATA, { lowStock: 1 });
  assert.match(on, /class="fp sel"/);
  assert.match(on, /id="low-stock"/);
});

test('a filter that finds nothing says so instead of going blank', () => {
  /* Only reachable now by a recipe that fills every row itself: a page that
     falls back to the shop's shelf always finds something, because a real
     shelf always has something running out. */
  const stocked = Array.from({ length: 14 }, (_, i) => ({ name: 'ITEM ' + i, rate: 10, stock: 90 }));
  const html = SCREENS.items.render({ items: stocked }, { lowStock: 1 });
  assert.match(html, /Nothing is running low/);
});

test('tapping Low Stock reaches the screen state', () => {
  const recipe = {
    video: 'x', items: ITEMS, invoice: {}, business: {}, party: {}, brand: {},
    shots: [{ screen: 'items', duration: 3, actions: [{ at: 1, do: 'tap', target: 'low-stock' }] }]
  };
  assert.ok(!stateAt(recipe, 0.5).screenState.lowStock, 'nothing before the tap lands');
  assert.equal(stateAt(recipe, 1.5).screenState.lowStock, 1);
});

test('low-stock is a real target in the catalogue', () => {
  assert.ok(catalogue().items.includes('low-stock'));
  assert.match(SCREENS.items.render(DATA, {}), /id="low-stock"/);
});

test('a clip that shows Low Stock with an empty page is warned about', () => {
  /* The page empties only when the recipe fills every row itself and none of
     them is low. One healthy item used to be enough to trigger this, because
     the rest of the page came from a shelf with nothing running out on it -
     so the warning fired at scripts whose Low Stock page was perfectly good
     and told the writer to go and fix something that was not broken. */
  const stocked = Array.from({ length: 14 }, (_, i) =>
    `  - { name: ITEM ${i}, rate: 10, qty: 1, stock: 90 }`);
  const yaml = [
    'video: t', 'invoice: { number: 1 }', 'business: { name: S }',
    'items:', ...stocked,
    'shots:', '  - screen: items', '    duration: 3',
    '    actions:', '      - { at: 1, do: tap, target: low-stock }'
  ].join('\n');
  const out = parse(yaml, catalogue());
  assert.equal(out.errors, undefined, 'it should still render');
  assert.ok(out.warnings.some(w => /nothing on the page is low/.test(w)), out.warnings.join(' | '));
});

test('a healthy shop is not warned about a Low Stock page that works', () => {
  /* The false alarm itself. The shop's own items are all well stocked, and
     its shelf still has things running out on it, so the page is fine. */
  const yaml = [
    'video: t', 'invoice: { number: 1 }', 'business: { name: S }',
    'items:', '  - { name: A, rate: 10, qty: 1, stock: 90 }',
    'shots:', '  - screen: low-stock', '    duration: 3'
  ].join('\n');
  const out = parse(yaml, catalogue());
  assert.equal(out.errors, undefined);
  assert.ok(!out.warnings.some(w => /low/i.test(w)), out.warnings.join(' | '));
});

test('the screens that open filtered are warned about too', () => {
  /* Reaching the page by naming it rather than tapping does not make an
     empty page any less empty. */
  const stocked = Array.from({ length: 14 }, (_, i) =>
    `  - { name: ITEM ${i}, rate: 10, qty: 1, stock: 90 }`);
  for (const screen of ['low-stock', 'mbb-desktop-low-stock']) {
    const out = parse([
      'video: t', 'invoice: { number: 1 }', 'business: { name: S }',
      'items:', ...stocked,
      'shots:', `  - screen: ${screen}`, '    duration: 3'
    ].join('\n'), catalogue());
    assert.ok(out.warnings.some(w => /nothing on the page is low/.test(w)),
      `${screen}: ${out.warnings.join(' | ')}`);
  }
});

test('no warning when something actually is low', () => {
  const yaml = [
    'video: t', 'invoice: { number: 1 }', 'business: { name: S }',
    'items:', '  - { name: A, rate: 10, qty: 1, stock: 3 }',
    'shots:', '  - screen: items', '    duration: 3',
    '    actions:', '      - { at: 1, do: tap, target: low-stock }'
  ].join('\n');
  const out = parse(yaml, catalogue());
  assert.ok(!out.warnings.some(w => /no item is low/.test(w)));
});

/* --- the Scan & Record entry screen -------------------------------------- */

test('scan-bills is registered and renders with nothing', () => {
  assert.ok(SCREENS['scan-bills']);
  assert.ok(SCREENS['scan-bills'].render({}, {}).length > 200);
});

test('scan-bills offers both ways in', () => {
  const html = SCREENS['scan-bills'].render(DATA, {});
  assert.match(html, /id="open-camera"/);
  assert.match(html, /id="upload-pdf"/);
  assert.match(html, /Open Camera/);
});

test('scan-bills carries no photograph of a real invoice', () => {
  /* The gallery strip in the reference is the owner's own phone photos. */
  const html = SCREENS['scan-bills'].render(DATA, {});
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Unknown Party/);
});

test('scan-bills shows both scan outcomes', () => {
  const html = SCREENS['scan-bills'].render(DATA, {});
  assert.match(html, /Completed/);
  assert.match(html, /Incomplete/);
});

test('every scan-bills target exists in the markup', () => {
  const html = SCREENS['scan-bills'].render(DATA, {});
  for (const id of Object.keys(SCREENS['scan-bills'].targets)) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

test('neither screen emits a raw hex colour', () => {
  for (const key of ['items', 'scan-bills']) {
    for (const state of [{}, { lowStock: 1 }]) {
      assert.doesNotMatch(SCREENS[key].render(DATA, state), /(?<!&)#[0-9a-fA-F]{6}/, key);
    }
  }
});

/* What Low Stock actually looks like.
 *
 * Aryan sent a photograph of the real screen: a promo strip across the top,
 * and a list that is mostly red, full of negatives, because a shop sells
 * past what the app thinks it has and reconciles later. The studio drew a
 * short tidy list of small positive numbers and no strip - and for seven of
 * the eight trades it drew nothing at all, because their shelves had no low
 * item on them. A script asking a cosmetics shop for Low Stock got an empty
 * page that said "Nothing is running low."
 */

test('every trade has something running low, so the screen is never empty', async () => {
  const { SHELVES } = await import('../src/shelves.js');
  for (const [trade, shelf] of Object.entries(SHELVES)) {
    const low = shelf.filter(isLow);
    assert.ok(low.length >= 3,
      `a ${trade} shop has ${low.length} low items, so Low Stock is a near-empty page`);
    assert.ok(low.some(i => i.stock < 0),
      `nothing in a ${trade} shop is oversold - the real screen is full of negatives`);
    /* And it is not simply a depleted shop: the unfiltered page must still
       read as a business with stock in it. */
    assert.ok(shelf.filter(i => !isLow(i)).length >= 5,
      `a ${trade} shop looks like it is going out of business`);
  }
});

test('the Low Stock list is long enough to fill the screen', async () => {
  const { itemsFor } = await import('../screens/items.js');
  const { SHELVES } = await import('../src/shelves.js');
  for (const trade of Object.keys(SHELVES)) {
    const shown = lowStockItems(itemsFor({ business: { trade } }));
    assert.ok(shown.length >= 3, `${trade} shows ${shown.length} rows under Low Stock`);
  }
});

test('the promo strip is drawn, and the rows are measured below it', async () => {
  const { PROMO_HEIGHT, targets } = await import('../screens/items.js');
  const html = SCREENS.items.render(DATA, { lowStock: 1 });

  assert.match(html, /class="ipromo"/, 'the strip the app shows is missing');
  assert.match(html, /Try Now/);

  /* The strip pushed every row down. MEASURED from a render; if the strip's
     height changes and this does not, every row target points at the gap
     between two cards. */
  assert.equal(PROMO_HEIGHT, 104);
  assert.equal(targets['item-row-0'].y, 264, 'row 0 is not where the strip leaves it');
  assert.equal(
    targets['item-row-1'].y - targets['item-row-0'].y, 94,
    'the rows are no longer one card apart'
  );
});

test('the strip is not an imitation of FloBiz artwork', () => {
  /* The app puts an illustration beside the text. It is marketing artwork
     and is deliberately not redrawn - a gap is better than a copy. */
  const html = SCREENS.items.render(DATA, {});
  assert.ok(!/<svg[^>]*ipromo-art|ipromo-img|background-image/.test(html),
    'the strip grew a picture');
});

test('a negative stock is drawn in red, like every other low one', () => {
  const html = SCREENS.items.render(
    { items: [{ name: 'PANEER ROLL', rate: 60, stock: -16, unit: 'PCS' }] }, { lowStock: 1 }
  );
  assert.match(html, /class="q low">-16\.0</, 'an oversold item is not marked low');
});

/* Asking for Low Stock is enough.
 *
 * There was no such screen: the only way to the filtered page was to film
 * `items` and tap `low-stock`. So a script that asked what was running out
 * got the ordinary stock list - the model wrote `screen: items` and often no
 * tap at all - and even when it did write one, the first second and a half
 * of the shot was the unfiltered page. Aryan hit this twice.
 */

test('the low-stock screen opens already filtered', () => {
  const html = SCREENS['low-stock'].render(DATA, {});
  assert.match(html, /class="fp sel"/, 'it opened with the filter off');
  assert.ok(!html.includes('WHITE CEMENT 5KG'), 'a well-stocked item is on the filtered page');
  assert.ok(html.includes('CEMENT OPC 50KG'), 'a low item is missing from it');
});

test('tapping the pill on that screen clears the filter, as its X does', () => {
  const off = SCREENS['low-stock'].render(DATA, { lowStock: 0 });
  assert.doesNotMatch(off, /class="fp sel"/);
  assert.ok(off.includes('WHITE CEMENT 5KG'), 'clearing it did not bring the rest back');
});

test('it is the Items page, not a second copy of it', () => {
  /* Two copies would drift, and the two pages would stop agreeing about
     where a row is - which is the kind of thing nothing reports. */
  const items = SCREENS.items;
  const low = SCREENS['low-stock'];
  assert.deepEqual(low.targets, items.targets);
  assert.deepEqual(low.scrollingTargets, items.scrollingTargets);
  assert.equal(low.render(DATA, { lowStock: 1 }), items.render(DATA, { lowStock: 1 }),
    'the same state draws two different pages');
});

test('a laptop clip about running out is still about running out', async () => {
  /* The screen a recipe gets when the studio is told to film on a laptop. */
  const { screenOnShape } = await import('../src/shape.js');
  assert.equal(screenOnShape('low-stock', 'laptop'), 'mbb-desktop-low-stock');
  assert.equal(screenOnShape('mbb-desktop-low-stock', 'phone'), 'low-stock');

  const html = SCREENS['mbb-desktop-low-stock'].render(DATA, {});
  assert.ok(html.includes('CEMENT OPC 50KG'), 'the laptop page lost the low item');
  assert.ok(!html.includes('WHITE CEMENT 5KG'), 'the laptop page opened unfiltered');
});

test('a recipe can simply name it', () => {
  const { recipe, errors } = parse(
    'video: t\nitems: [{ name: SUGAR 5KG, rate: 310, stock: 4 }]\n'
    + 'shots:\n  - screen: low-stock\n    duration: 3\n',
    catalogue(), {}
  );
  assert.equal(errors, undefined, 'the screen a script would ask for is refused');
  assert.equal(recipe.shots[0].screen, 'low-stock');
});
