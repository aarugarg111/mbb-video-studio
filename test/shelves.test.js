import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { SHELVES, TRADES, tradeOf, shelfFor } from '../src/shelves.js';
import { itemsFor } from '../screens/items.js';
import { parse } from '../src/recipe.js';
import { catalogue, scrollables } from '../screens/index.js';

/* A shop stocks one trade.
 *
 * The inventory page was a recipe's own two or three items followed by one
 * fixed kirana shelf, whatever the shop sold. A cosmetics script listed
 * FACEWASH and NAIL PAINT and then ARHAR DAL GOLD 1KG, BESAN 1KG and CHANA
 * DAL - the same page showing two different shops three rows apart. Aryan
 * caught it on screen; nothing here failed. */

const COSMETICS = {
  business: { name: 'SHREE BEAUTY COLLECTION' },
  items: [
    { name: 'FACEWASH 100ML', rate: 185, qty: 3 },
    { name: 'NAIL PAINT', rate: 120, qty: 5 }
  ]
};

/* The words that gave the game away, and must not come back. */
const GROCERIES = /\b(DAL|BESAN|ATTA|RUSK|ANJEER|BOURNVITA|MARIE GOLD|SALT)\b/;

test('a cosmetics shop stocks cosmetics, and no groceries', () => {
  const names = itemsFor(COSMETICS).map(i => i.name);
  assert.equal(tradeOf(COSMETICS), 'cosmetics');
  const stray = names.filter(n => GROCERIES.test(n));
  assert.deepEqual(stray, [], `a grocer's stock reached a cosmetics shop: ${stray}`);
  assert.ok(names.length > 5, 'and the page is still a full page');
});

test('the shop own items come first and stay first', () => {
  const names = itemsFor(COSMETICS).map(i => i.name);
  assert.deepEqual(names.slice(0, 2), ['FACEWASH 100ML', 'NAIL PAINT']);
});

test('what the recipe says it sells beats what the items sound like', () => {
  /* A script can name a category outright. It wins: the items on a bill are
   * two or three lines and the shop is the whole shelf. */
  const stated = { ...COSMETICS, business: { ...COSMETICS.business, trade: 'pharmacy' } };
  assert.equal(tradeOf(stated), 'pharmacy');
  assert.equal(tradeOf({ ...stated, business: { trade: '  PHARMACY  ' } }), 'pharmacy',
    'a pasted value brings whitespace and capitals');
});

test('a trade nobody stocks is refused, with the choices named', () => {
  /* It used to pass straight through and quietly restock the shop with dal. */
  const { errors } = parse(
    'video: t\nbusiness: { name: X, trade: groceryy }\nshots: []\n',
    catalogue(), { scrollable: scrollables() }
  );
  assert.ok(errors, 'a misspelt trade must not render');
  assert.match(errors.join(' '), /groceryy/);
  for (const t of TRADES) assert.match(errors.join(' '), new RegExp(t));
});

test('a shop whose items say nothing falls back rather than guessing', () => {
  /* Guessing wrong is this bug pointed the other way, so one shared word is
   * not enough: "paint" is a nail paint and a wall paint. */
  assert.equal(tradeOf({ items: [{ name: 'PAINT' }] }), 'kirana');
  assert.equal(tradeOf({ items: [] }), 'kirana');
  assert.equal(tradeOf({}), 'kirana');
});

test('each trade reads like its own trade and nobody else', () => {
  for (const [trade, shelf] of Object.entries(SHELVES)) {
    assert.ok(shelf.length >= 8, `${trade} is too short to scroll`);
    for (const item of shelf) {
      assert.ok(item.name && item.rate > 0, `${trade} has an item with no name or rate`);
      assert.ok(item.purchase < item.rate, `${trade}: ${item.name} sells below cost`);
      assert.ok(Number.isFinite(item.stock), `${trade}: ${item.name} has no stock`);
    }
    const names = new Set(shelf.map(i => i.name));
    assert.equal(names.size, shelf.length, `${trade} lists something twice`);
  }
});

test('an item the recipe already lists is not on the shelf twice', () => {
  const own = { items: [{ name: 'lipstick matte', rate: 280 }], business: { trade: 'cosmetics' } };
  const shelf = shelfFor(own).map(i => i.name.toLowerCase());
  assert.ok(!shelf.includes('lipstick matte'), 'the page listed one item twice');
});

test('every recipe that films its inventory stocks the right trade', () => {
  /* The two recipes that actually show the Items page. A shelf nobody films
   * can be wrong quietly; these two cannot. */
  const dir = new URL('../recipes/', import.meta.url);
  const shown = readdirSync(dir)
    .filter(n => n.endsWith('.yaml'))
    .filter(n => /screen:\s*(items|mbb-desktop-items|low-stock)/.test(readFileSync(new URL(n, dir), 'utf8')));

  assert.ok(shown.length > 0, 'no recipe films its inventory at all');
  for (const f of shown) {
    const data = yaml.load(readFileSync(new URL(f, dir), 'utf8'));
    const names = itemsFor(data).map(i => i.name).join(' | ');
    assert.ok(!GROCERIES.test(names) || tradeOf(data) === 'kirana',
      `${f} is a ${tradeOf(data)} shop stocking groceries: ${names}`);
  }
});
