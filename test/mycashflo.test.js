import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { ledger, attentionCards, short, rupeesExact, phoneOf, PLACEHOLDER_PHONE } from '../screens/mcf-data.js';

const MCF = ['mcf-dashboard', 'mcf-parties', 'mcf-party', 'mcf-automations'];

const recipe = {
  business: { name: 'BALAJI TRADING CO' },
  party: { name: 'SURESH TRADERS', balance: 310000, overdueDays: 103, standby: 3 }
};

test('every myCashFlo screen renders with nothing at all', () => {
  for (const name of MCF) {
    const html = SCREENS[name].render({}, {});
    assert.equal(typeof html, 'string');
    assert.ok(html.includes('class="screen mcfscreen"'), name);
  }
});

test('all four are in the catalogue, so a recipe can name them', () => {
  const cat = catalogue();
  for (const name of MCF) {
    assert.ok(Array.isArray(cat[name]), name + ' is missing from the catalogue');
    assert.ok(cat[name].length > 0, name + ' has no tap targets');
  }
});

test('no myCashFlo screen emits a raw colour', () => {
  for (const name of MCF) {
    const html = SCREENS[name].render(recipe, {});
    assert.equal(html.match(/#[0-9a-fA-F]{3,8}\b/), null, name + ' has a hard-coded colour');
    assert.equal(html.match(/rgba?\(/), null, name + ' has a hard-coded colour');
  }
});

/* The reference recording is of a real shop. Its screens carry real party
 * names and a real phone number, and these clips are published - a viewer
 * could ring a number that reached the code by accident. */
test('nothing from the reference recording appears on any screen', () => {
  /* Split so the number itself is not written here in one piece either. */
  const realNumber = '85277' + '64815';
  for (const name of MCF) {
    const html = SCREENS[name].render(recipe, {});
    assert.ok(!html.includes(realNumber), name + ' carries the number from the recording');
    for (const realName of ['Darshan Yadav', 'Vishal Singh', 'Sachin Singh', 'Vaishak', 'Mehul', 'ARYAN ENTERPRISES']) {
      assert.ok(!html.includes(realName), `${name} carries "${realName}" from the recording`);
    }
  }
});

test('a phone number is the standard placeholder unless the recipe gives one', () => {
  assert.equal(phoneOf({}), PLACEHOLDER_PHONE);
  assert.equal(phoneOf({ phone: '99999 00000' }), '99999 00000');
  assert.ok(SCREENS['mcf-party'].render(recipe, {}).includes(PLACEHOLDER_PHONE));
});

test('money is written the short way the app writes it', () => {
  assert.equal(short(0), '₹0');
  assert.equal(short(900), '₹900');
  assert.equal(short(8400), '₹8.4K');
  assert.equal(short(150000), '₹1.5L');
  assert.equal(short(1490000), '₹14.9L');
  assert.equal(short(12000000), '₹1.2Cr');
  /* A round figure loses its trailing zero, as the app's own ₹1.5L / ₹3.1L do
   * not read "3.10L". */
  assert.equal(short(300000), '₹3L');
});

test('the wallet balance keeps its paise and its Indian grouping', () => {
  assert.equal(rupeesExact(2967.5), '2,967.50');
  assert.equal(rupeesExact(145000), '1,45,000.00');
  assert.equal(rupeesExact(12), '12.00');
});

test('the dashboard total is the sum of the parties under it', () => {
  const book = ledger(recipe);
  const summed = book.parties.reduce((t, p) => t + p.balance, 0);
  assert.equal(book.outstanding, summed);
  /* Overdue can never exceed what is outstanding - on camera that would read
   * as the app having got its own arithmetic wrong. */
  assert.ok(book.overdue <= book.outstanding);
});

test('the recipe party leads the book and is not also listed as a filler', () => {
  const book = ledger({ party: { name: 'SURESH TRADERS', balance: 500000 } });
  assert.equal(book.parties[0].name, 'SURESH TRADERS');
  assert.equal(book.parties[0].balance, 500000);
  assert.equal(book.parties.filter(p => p.name === 'SURESH TRADERS').length, 1);
});

test('with no party named the book still stands on its own', () => {
  const book = ledger({});
  assert.ok(book.parties.length >= 5);
  assert.ok(book.outstanding > 0);
});

test('the attention strip puts two to a card and counts the rest', () => {
  const cards = attentionCards(ledger(recipe));
  assert.equal(cards.length, 2, 'a second card is what shows the strip scrolls');
  assert.equal(cards[0].parties.length, 2);
  for (const p of cards.flatMap(c => c.parties)) {
    assert.ok(p.overdueDays > 0, 'only an overdue party needs attention');
    assert.ok(p.reason, 'every flagged party says why it is flagged');
  }
});

test('the parties list shows how late each one is, and only when they are', () => {
  const html = SCREENS['mcf-parties'].render(recipe, {});
  assert.ok(html.includes('103d overdue'), 'the recipe party carries its own overdue days');
  const rows = html.split('mcf-prow"').length - 1;
  const lates = html.split('mcf-prow-late').length - 1;
  assert.ok(lates < rows, 'a party who is not overdue must not be labelled overdue');
});

test('pausing the calls changes what the party screen says', () => {
  const before = SCREENS['mcf-party'].render(recipe, {});
  const after = SCREENS['mcf-party'].render(recipe, { paused: 1 });

  assert.ok(before.includes('ACTIVE AUTOMATION (0)'));
  assert.ok(after.includes('ACTIVE AUTOMATION (1)'), 'pausing by hand starts an automation');
  assert.ok(!before.includes('mcf-toggle on'), 'the toggle starts off');
  assert.ok(after.includes('mcf-toggle on'), 'and is on once tapped');
  assert.ok(after.includes('Calls paused'));
});

test('the tap on the toggle is wired, or it would move and change nothing', () => {
  assert.deepEqual(SCREENS['mcf-party'].tapEffects['pause-calls'], { paused: 1 });
});

test('every myCashFlo tap target has an element behind it', () => {
  /* A target with no element cannot be tapped and nothing otherwise complains:
   * the ripple lands on empty background and the clip quietly means nothing. */
  for (const name of MCF) {
    const html = SCREENS[name].render(recipe, {});
    for (const id of Object.keys(SCREENS[name].targets)) {
      assert.ok(html.includes(`id="${id}"`), `${name}: nothing carries id="${id}"`);
    }
  }
});

test('the bottom bar is the same on every screen that has one', () => {
  const bars = ['mcf-dashboard', 'mcf-parties', 'mcf-automations'].map(name => {
    const html = SCREENS[name].render(recipe, {});
    /* Which tab is lit is the one thing allowed to differ, so the class
       attribute goes before the comparison. */
    return html.slice(html.indexOf('class="mcf-nav"'))
      .replace(/ class="(on)?"/g, '')
      .replace(/\s+/g, ' ');
  });
  assert.equal(bars[0], bars[1], 'a bar that differs between screens reads as the app glitching');
  assert.equal(bars[1], bars[2]);
});

test('the party page has no bottom bar, because it is pushed over one', () => {
  assert.ok(!SCREENS['mcf-party'].render(recipe, {}).includes('mcf-nav'));
});

test('the automation counts come from the book rather than from nowhere', () => {
  const html = SCREENS['mcf-automations'].render(recipe, {});
  assert.ok(html.includes('ACTIVE AUTOMATIONS (3)'));
  assert.ok(html.includes('Overdue 1 day to 1 month'));
  assert.ok(html.includes('Overdue 6m+'));
});

test('a party whose name would break the markup is escaped', () => {
  const nasty = { party: { name: '<script>alert(1)</script>', balance: 100 } };
  for (const name of MCF) {
    const html = SCREENS[name].render(nasty, {});
    assert.ok(!html.includes('<script>'), name + ' let a party name through unescaped');
  }
});

test('a clip that mixes the two apps is flagged', async () => {
  const { parse } = await import('../src/recipe.js');
  const mixed = [
    'video: mixed',
    'shots:',
    '  - { screen: home, duration: 2 }',
    '  - { screen: mcf-dashboard, duration: 2 }'
  ].join('\n');

  const result = parse(mixed, catalogue(), {});
  assert.equal(result.errors, undefined, 'both screens are real, so it still renders');
  assert.ok(
    result.warnings.some(w => w.includes('myCashFlo')),
    'mixing myBillBook and myCashFlo screens must be called out'
  );

  const pure = parse('video: pure\nshots:\n  - { screen: mcf-dashboard, duration: 2 }', catalogue(), {});
  assert.ok(!pure.warnings.some(w => w.includes('mixes')), 'one product on its own is fine');
});
