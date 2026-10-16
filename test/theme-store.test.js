import test from 'node:test';
import { themeArtUrl } from '../src/themes.js';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { FESTIVE_THEMES } from '../src/themes.js';
import { parse, BUILT_IN_THEMES } from '../src/recipe.js';
import { stateAt } from '../src/timeline.js';

const screen = SCREENS['theme-store'];
const DATA = {
  business: { name: 'Sagar Superbazaar' },
  party: { name: 'Aryan Enterprises' },
  items: [{ name: 'Arhar Dal', rate: 180, qty: 1 }],
  invoice: { number: 5947, date: '10/10/2026', theme: 'none' }
};

test('theme-store is registered and renders with {}', () => {
  assert.ok(screen);
  assert.doesNotThrow(() => screen.render({}, {}));
  assert.doesNotThrow(() => screen.render(undefined, undefined));
  assert.ok(catalogue()['theme-store'].includes('unlock'));
});

test('all sixteen themes appear in the grid, in order', () => {
  const html = screen.render(DATA, {});
  assert.equal(FESTIVE_THEMES.length, 16);
  let at = -1;
  for (const t of FESTIVE_THEMES) {
    const i = html.indexOf('>' + t.name + '<');
    assert.ok(i > at, `${t.name} missing or out of order`);
    at = i;
  }
});

test('the selected card is marked and the variant chips follow its name', () => {
  const html = screen.render(DATA, { theme: 'diwali' });
  assert.equal((html.match(/class="tcard on"/g) || []).length, 1);
  assert.match(html, /tcard on" id="theme-4"/);
  assert.match(html, /id="variant-1">Diwali 1</);
  assert.match(html, /id="variant-2">Diwali 2</);
  const other = screen.render(DATA, { theme: 'rakhi' });
  assert.match(other, /Rakhi 1</);
  assert.doesNotMatch(other, /Diwali 1</);
});

test('with nothing chosen there is no selection and no chips; recipe theme is the default', () => {
  const none = screen.render(DATA, {});
  assert.doesNotMatch(none, /tcard on/);
  assert.doesNotMatch(none, /class="tchip/);
  const recipe = screen.render({ ...DATA, invoice: { ...DATA.invoice, theme: 'onam' } }, {});
  assert.match(recipe, /Onam 1</);
});

test('a theme with art uses it; one without falls back to a tinted card', () => {
  const html = screen.render({ ...DATA, themeArt: ['diwali'] }, {});
  /* Both extensions are named: this art is photographic and FloBiz supplies
     JPEGs, but kit/themes/README.md has always asked for PNG, so a set
     delivered either way has to work. */
  assert.match(html, /th art" style="background-image: [^"]*themes\/diwali\.jpg/);
  assert.match(html, /th art" style="background-image: [^"]*themes\/diwali\.png/);
  assert.match(html, /th noart" style="background-image: linear-gradient\(var\(--mbb-theme-rakhi\)/);
  assert.doesNotMatch(html, /themes\/rakhi\./);
});

test('the second chip asks for the second picture, behind the first', () => {
  /* A festival can have two artworks, which is what the Theme Store's two
     chips choose between. One with only a single picture must show that on
     both chips rather than going blank on the second - so the festival's own
     art is always named as the layer behind the variant. */
  const second = themeArtUrl('diwali', 2);
  assert.match(second, /themes\/diwali-2\.jpg/);
  assert.ok(
    second.indexOf('diwali-2.jpg') < second.indexOf('diwali.jpg'),
    'the variant has to be painted in front of the one it falls back to'
  );
  assert.match(second, /themes\/diwali\.jpg/);
  assert.equal(themeArtUrl('onam', 1).includes('onam-2'), false);
});

test('the bill behind the sheet wears the chosen theme', () => {
  const html = screen.render(DATA, { theme: 'diwali' });
  assert.match(html, /bill-theme/);
  assert.match(html, /kit\/themes\/diwali\.png/);
  assert.match(html, /Sales Invoice Created/);
});

test('the sheet slides: 0 is below the screen, 1 at rest', () => {
  assert.match(screen.render(DATA, { sheet: 0 }), /translateY\(100\.00%\)/);
  assert.match(screen.render(DATA, { sheet: 1 }), /translateY\(0\.00%\)/);
});

test('recipe accepts every festive slug and still warns on an unknown one', () => {
  const text = t => `video: t\ninvoice: { number: 1, date: "01/01/2026", theme: ${t} }\nshots:\n  - { screen: theme-store, duration: 2 }\n`;
  for (const t of FESTIVE_THEMES) {
    assert.ok(BUILT_IN_THEMES.includes(t.slug));
    const res = parse(text(t.slug), catalogue());
    assert.equal(res.errors, undefined, t.slug);
    assert.equal(res.recipe.invoice.theme, t.slug);
    assert.equal(res.warnings.filter(w => /theme/.test(w)).length, 0);
  }
  const bad = parse(text('holi-hai'), catalogue());
  assert.equal(bad.errors, undefined);
  assert.equal(bad.recipe.invoice.theme, 'none');
  assert.ok(bad.warnings.some(w => /theme/.test(w)));
});

test('tapping a card sets the theme, and it survives into the next shot', () => {
  const recipe = {
    invoice: {}, items: [], brand: null,
    shots: [
      { screen: 'theme-store', duration: 4, actions: [{ at: 1, do: 'tap', target: 'theme-4' }] },
      { screen: 'invoice-created', duration: 2, actions: [] }
    ]
  };
  assert.equal(stateAt(recipe, 0.5).screenState.theme, undefined);
  assert.equal(stateAt(recipe, 1.5).screenState.theme, 'diwali');
  assert.equal(stateAt(recipe, 5).screenState.theme, 'diwali');
});

test('closing slides the sheet back down', () => {
  const recipe = {
    invoice: {}, items: [], brand: null,
    shots: [{ screen: 'theme-store', duration: 4, actions: [{ at: 2, do: 'tap', target: 'close' }] }]
  };
  assert.equal(stateAt(recipe, 1.5).screenState.sheet, 1);
  assert.ok(stateAt(recipe, 3.9).screenState.sheet < 0.01);
});

test('no screen emits a raw hex or rgb colour', () => {
  for (const [key, mod] of Object.entries(SCREENS)) {
    const html = mod.render(DATA, { theme: 'diwali' });
    /* The lookbehind spares numeric character references: &#160; is a
       non-breaking space, not a three-digit hex colour. */
    assert.doesNotMatch(html, /(?<!&)#[0-9a-fA-F]{6}\b|(?<!&)#[0-9a-fA-F]{3}\b|rgba?\(/, `${key} has a hard-coded colour`);
  }
});

test('the chosen variant survives the cut, like the theme does', () => {
  /* The Theme Store sets both and then the clip cuts away to the bill. Only
     the theme used to survive that cut, which did not matter while the two
     chips chose between two labels and the same picture. The moment they
     chose different pictures it did: a clip that picked Diwali 2 and cut to
     the bill showed Diwali 1. */
  for (const name of ['theme-store', 'mbb-desktop-theme-store']) {
    const keeps = SCREENS[name].persists ?? [];
    assert.ok(keeps.includes('theme'), `${name} loses the theme between shots`);
    assert.ok(keeps.includes('variant'), `${name} loses the chosen variant between shots`);
  }
});
