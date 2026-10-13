import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/recipe.js';
import { catalogue } from '../screens/index.js';
import { voiceLines, shotStarts, timecode, toSrt, toScript } from '../src/voiceover.js';
import { TRANSCRIPT } from '../screens/mcf-ai-call.js';

const build = shots => {
  const { recipe, errors } = parse(
    ['video: vo-test', 'party: { name: AGRAWAL CONSTRUCTIONS, balance: 1400000, overdueDays: 68 }',
      'shots:', ...shots].join('\n'),
    catalogue(), {});
  assert.equal(errors, undefined, JSON.stringify(errors));
  return recipe;
};

test('a shot starts where the ones before it end', () => {
  const recipe = build([
    '  - { screen: mcf-parties, duration: 3 }',
    '  - { screen: mcf-ai-ringing, duration: 2.5 }',
    '  - { screen: mcf-ai-call, duration: 9.5 }'
  ]);
  assert.deepEqual(shotStarts(recipe), [0, 3, 5.5]);
});

test('the call lines are timed from the start of the whole clip', () => {
  const recipe = build([
    '  - { screen: mcf-parties, duration: 4 }',
    '  - { screen: mcf-ai-call, duration: 9.5 }'
  ]);
  const lines = voiceLines(recipe);
  assert.equal(lines.length, TRANSCRIPT.length);
  /* The first line lands 0.8s into its own shot, which begins at 4s. */
  assert.equal(lines[0].at, 4 + TRANSCRIPT[0].at);
  assert.ok(lines.every((l, i) => i === 0 || l.at >= lines[i - 1].at), 'in order');
});

test('moving a shot moves its lines with it', () => {
  const early = voiceLines(build(['  - { screen: mcf-ai-call, duration: 9.5 }']));
  const late = voiceLines(build([
    '  - { screen: mcf-dashboard, duration: 6 }',
    '  - { screen: mcf-ai-call, duration: 9.5 }'
  ]));
  assert.equal(late[0].at - early[0].at, 6);
});

test('only the AI lines are marked for a voice', () => {
  const lines = voiceLines(build(['  - { screen: mcf-ai-call, duration: 9.5 }']));
  const voiced = lines.filter(l => l.voiced);
  assert.ok(voiced.length > 0);
  assert.ok(voiced.every(l => l.speaker === 'myCashFlo AI'));
  /* The party's reply is listed but never voiced - it is there so a creator
     knows how long a gap to leave. */
  const theirs = lines.filter(l => !l.voiced);
  assert.ok(theirs.length > 0);
  assert.ok(theirs.every(l => l.speaker === 'AGRAWAL CONSTRUCTIONS'));
});

test('the party is named from the recipe, not invented', () => {
  const lines = voiceLines(build(['  - { screen: mcf-ai-call, duration: 9.5 }']));
  assert.ok(lines.some(l => l.speaker === 'AGRAWAL CONSTRUCTIONS'));
});

test('a line the shot is too short to reach is left out', () => {
  /* Writing down a line nobody will see is worse than omitting it: somebody
     would record it and wonder where it went. */
  const lines = voiceLines(build(['  - { screen: mcf-ai-call, duration: 2 }']));
  assert.ok(lines.every(l => l.at < 2));
  assert.ok(lines.length < TRANSCRIPT.length);
});

test('a line never outlasts its own shot', () => {
  const lines = voiceLines(build(['  - { screen: mcf-ai-call, duration: 4 }']));
  for (const l of lines) assert.ok(l.until <= 4, `${l.text} runs past the shot`);
});

test('a clip with no dialogue produces no lines at all', () => {
  const recipe = build([
    '  - { screen: home, duration: 3 }',
    '  - { screen: create-invoice, duration: 4 }'
  ]);
  assert.deepEqual(voiceLines(recipe), []);
  assert.equal(toScript([]), '', 'and no file is worth writing');
});

test('timecodes are the ones an editor expects', () => {
  assert.equal(timecode(0), '00:00:00,000');
  assert.equal(timecode(4.8), '00:00:04,800');
  assert.equal(timecode(61.25), '00:01:01,250');
  assert.equal(timecode(3725), '01:02:05,000');
  assert.equal(timecode(-1), '00:00:00,000');
});

test('the subtitle file is numbered, ordered and names the speaker', () => {
  const srt = toSrt(voiceLines(build(['  - { screen: mcf-ai-call, duration: 9.5 }'])));
  assert.match(srt, /^1\n00:00:00,800 --> /);
  assert.ok(srt.includes('myCashFlo AI: Sir, payment kab tak clear ho jayega?'));
  /* Every entry: a number, a time range, a line. */
  const blocks = srt.trim().split('\n\n');
  blocks.forEach((b, i) => {
    const [n, times] = b.split('\n');
    assert.equal(Number(n), i + 1);
    assert.match(times, / --> /);
  });
});

test('the readable script says which lines need a voice', () => {
  const script = toScript(voiceLines(build(['  - { screen: mcf-ai-call, duration: 9.5 }'])));
  assert.match(script, /VOICE/);
  assert.match(script, /how long a gap to leave/);
  assert.ok(script.includes('Sir, payment kab tak clear ho jayega?'));
});

test('it survives a recipe with nothing in it', () => {
  assert.deepEqual(voiceLines({}), []);
  assert.deepEqual(shotStarts({}), []);
  assert.deepEqual(voiceLines({ shots: [{ screen: 'nope', duration: 2 }] }), []);
});

test('no two captions are ever on screen at once', () => {
  /* A fixed length is only right until two lines fall closer together than
     that, and then the subtitle file has overlapping cues - which some editors
     refuse outright. The real file had a 0.4s overlap while every test above
     passed; this is the one that would have caught it. */
  const recipe = build([
    '  - { screen: mcf-parties, duration: 4 }',
    '  - { screen: mcf-ai-call, duration: 9.5 }'
  ]);
  const lines = voiceLines(recipe);
  assert.ok(lines.length > 1);
  for (let i = 0; i < lines.length - 1; i++) {
    assert.ok(
      lines[i].until <= lines[i + 1].at,
      `"${lines[i].text}" is still up when "${lines[i + 1].text}" starts`
    );
    assert.ok(lines[i].until > lines[i].at, 'and every line is still on screen for a while');
  }
});

test('the subtitle file itself has no overlapping cues', () => {
  const srt = toSrt(voiceLines(build([
    '  - { screen: mcf-parties, duration: 4 }',
    '  - { screen: mcf-ai-call, duration: 9.5 }'
  ])));
  const times = [...srt.matchAll(/(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)/g)];
  for (let i = 0; i < times.length - 1; i++) {
    assert.ok(times[i][2] <= times[i + 1][1], `cue ${i + 1} overruns cue ${i + 2}`);
  }
});
