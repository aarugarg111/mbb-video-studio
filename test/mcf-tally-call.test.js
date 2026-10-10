import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, catalogue } from '../screens/index.js';
import { ledger, short } from '../screens/mcf-data.js';
import { syncProgress, SYNC_SECONDS } from '../screens/mcf-tally.js';
import { spokenBy, callTimer, TRANSCRIPT, COMMITMENT_AT } from '../screens/mcf-ai-call.js';

const DATA = {
  business: { name: 'SHREE BALAJI BUILDING MATERIALS' },
  party: { name: 'AGRAWAL CONSTRUCTIONS', balance: 1400000, overdueDays: 68, standby: 3 },
  cashflo: {
    parties: [
      { name: 'SHANTI INFRA PROJECTS', balance: 1150000, overdueDays: 94, standby: 3 },
      { name: 'M R BUILDCON', balance: 900000, overdueDays: 41, standby: 2 }
    ]
  }
};

test('both screens render with nothing at all', () => {
  for (const name of ['mcf-tally', 'mcf-ai-call']) {
    const html = SCREENS[name].render({}, {});
    assert.ok(html.includes('class="screen'), name);
  }
});

test('both are in the catalogue with targets that exist', () => {
  const cat = catalogue();
  for (const name of ['mcf-tally', 'mcf-ai-call']) {
    assert.ok(cat[name].length > 0, name);
    const html = SCREENS[name].render(DATA, { t: 9 });
    for (const id of cat[name]) {
      assert.ok(html.includes(`id="${id}"`), `${name}: nothing carries id="${id}"`);
    }
  }
});

test('neither emits a raw colour', () => {
  for (const name of ['mcf-tally', 'mcf-ai-call']) {
    for (const t of [0, 3, 9]) {
      const html = SCREENS[name].render(DATA, { t });
      assert.equal(html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/), null, name);
      assert.equal(html.match(/rgba?\(/), null, name);
    }
  }
});

test('a recipe that names its own parties gets exactly those', () => {
  /* A script that says "52 lakh" out loud needs the screen to show 52 lakh, or
     the video argues with its own voiceover. */
  const book = ledger(DATA);
  assert.equal(book.parties.length, 3, 'the recipe book is not padded with fillers');
  assert.equal(book.parties[0].name, 'AGRAWAL CONSTRUCTIONS');
  assert.equal(book.outstanding, 1400000 + 1150000 + 900000);
  assert.ok(!JSON.stringify(book.parties).includes('Meena Sharma'), 'no filler crept in');
});

test('a recipe that names nobody still gets a full book', () => {
  const book = ledger({});
  assert.ok(book.parties.length >= 5);
});

test('the sync runs and finishes inside the shot', () => {
  assert.equal(syncProgress(0), 0);
  assert.ok(syncProgress(SYNC_SECONDS / 2) > 0.4 && syncProgress(SYNC_SECONDS / 2) < 0.6);
  assert.equal(syncProgress(SYNC_SECONDS), 1);
  assert.equal(syncProgress(99), 1, 'it never runs past done');
  assert.equal(syncProgress(undefined), 0);
});

test('the figures count up with the bar rather than appearing whole', () => {
  const early = SCREENS['mcf-tally'].render(DATA, { t: 0 });
  const late = SCREENS['mcf-tally'].render(DATA, { t: SYNC_SECONDS });
  assert.ok(early.includes('Syncing'), 'it starts mid-sync');
  assert.ok(late.includes('Synced'), 'and ends done');
  assert.ok(late.includes(short(ledger(DATA).outstanding)), 'the finished total is the real one');
});

test('the call transcript arrives line by line, never early', () => {
  assert.deepEqual(spokenBy(0), []);
  assert.equal(spokenBy(TRANSCRIPT[0].at).length, 1);
  assert.equal(spokenBy(TRANSCRIPT[1].at).length, 2);
  assert.equal(spokenBy(99).length, TRANSCRIPT.length);
});

test('the commitment shows only after the last line is said', () => {
  const lastLine = TRANSCRIPT[TRANSCRIPT.length - 1].at;
  assert.ok(COMMITMENT_AT > lastLine, 'it must not land before the AI says it');

  const before = SCREENS['mcf-ai-call'].render(DATA, { t: COMMITMENT_AT - 0.1 });
  const after = SCREENS['mcf-ai-call'].render(DATA, { t: COMMITMENT_AT });
  assert.ok(!before.includes('Commitment noted'));
  assert.ok(after.includes('Commitment noted'));
});

test('the call timer counts from the start of its own shot', () => {
  assert.equal(callTimer(0), '00:00');
  assert.equal(callTimer(7.9), '00:07');
  assert.equal(callTimer(65), '01:05');
  assert.equal(callTimer(undefined), '00:00');
});

test('the call names the party the recipe named, and what they owe', () => {
  const html = SCREENS['mcf-ai-call'].render(DATA, { t: 9 });
  assert.ok(html.includes('AGRAWAL CONSTRUCTIONS'));
  assert.ok(html.includes('68d overdue'));
  assert.ok(html.includes('myCashFlo AI'));
});

test('the call screen has no bottom bar - it is a call, not a page', () => {
  assert.ok(!SCREENS['mcf-ai-call'].render(DATA, { t: 2 }).includes('mcf-nav'));
});

test('a party name that would break the markup is escaped on both', () => {
  const nasty = { party: { name: '<script>alert(1)</script>', balance: 100 } };
  for (const name of ['mcf-tally', 'mcf-ai-call']) {
    assert.ok(!SCREENS[name].render(nasty, { t: 9 }).includes('<script>'), name);
  }
});

test('neither screen claims to be Tally itself', () => {
  /* The studio renders app interfaces. Tally is somebody else's software and
     there is no reference for it, so this screen is myCashFlo's side of the
     connection - what it pulled across - and never an imitation of Tally. */
  const html = SCREENS['mcf-tally'].render(DATA, { t: 3 });
  assert.ok(html.includes('class="screen mcfscreen"'), 'it is a myCashFlo screen');
  assert.ok(html.includes('Tally Prime'), 'it names what it is connected to');
});

test('the book survives the validator, which is what the screens actually see', async () => {
  /* ledger() read straight from the YAML looked right while the rendered
     dashboard showed fillers and the wrong total: src/recipe.js copies only
     the keys it knows, and "cashflo" was not one of them. Checking the parsed
     recipe rather than the raw document is the whole point of this test. */
  const { parse } = await import('../src/recipe.js');
  const yamlText = [
    'video: book-test',
    'party: { name: AGRAWAL CONSTRUCTIONS, balance: 1400000, overdueDays: 68 }',
    'cashflo:',
    '  parties:',
    '    - { name: SHANTI INFRA PROJECTS, balance: 1150000, overdueDays: 94 }',
    'shots:',
    '  - { screen: mcf-dashboard, duration: 2 }'
  ].join('\n');

  const { recipe, errors } = parse(yamlText, catalogue(), {});
  assert.equal(errors, undefined);

  const book = ledger(recipe);
  assert.equal(book.outstanding, 2550000);
  assert.equal(book.parties.length, 2, 'no invented filler may pad a book the recipe named');

  const html = SCREENS['mcf-dashboard'].render(recipe, {});
  assert.ok(html.includes(short(2550000)), 'and the figure reaches the screen');
  assert.ok(!html.includes('Meena Sharma'));
});

test('a malformed book is refused with a line that says where', async () => {
  const { parse } = await import('../src/recipe.js');
  const bad = [
    'video: bad-book',
    'cashflo:',
    '  parties:',
    '    - { balance: 100 }',
    'shots:',
    '  - { screen: mcf-dashboard, duration: 2 }'
  ].join('\n');

  const { errors } = parse(bad, catalogue(), {});
  assert.ok(errors, 'a party with no name is an error');
  assert.ok(errors.some(e => e.includes('cashflo.parties[0]')), errors.join('; '));
});

test('both renderers hand screens the same data', async () => {
  /* stage/stage.js serves the command line and web/lib/render.ts the browser,
     and each picks the recipe keys it passes on BY HAND. A key added to one
     and not the other renders differently on the two paths - which is how
     "cashflo" reached the validator, and the screens, and still showed the
     wrong total in a video. */
  const { readFile } = await import('node:fs/promises');
  const keysIn = async (path) => {
    const src = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    const block = src.slice(src.indexOf('const data = {'));
    return [...block.slice(0, block.indexOf('};')).matchAll(/^\s*(\w+):/gm)].map(m => m[1]).sort();
  };

  assert.deepEqual(await keysIn('stage/stage.js'), await keysIn('web/lib/render.ts'));
  assert.ok((await keysIn('stage/stage.js')).includes('cashflo'));
});
