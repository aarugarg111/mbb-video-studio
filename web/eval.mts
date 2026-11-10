/* Does the free, fast model actually do the job?
 *
 *   GEMINI_API_KEY=AIza...  npx tsx eval.mts            (from web/)
 *   ...  --one 3                 just one script
 *   ...  --raw                   print the recipe behind a refusal
 *   MODELS=gemini-3.8-flash,gemini-3.5-flash-lite ...    compare two
 *
 * The studio's whole bill is one call per script. It ran on Opus for a year,
 * doing a job that is not writing but reading a script into a fixed
 * vocabulary of screens handed to it in the prompt. Gemini's free tier does
 * that class of work - but "I think it will" is not a reason to change what
 * the team's videos are made with, so this puts the SAME scripts through
 * every model there is a key for and prints the difference.
 *
 * It does not score with another model and it does not ask anyone to read
 * two YAML files side by side. Four things decide it, all of them things the
 * studio already knows how to check:
 *
 *   PARSES   - survives src/recipe.js, the same gate a hand-written shot
 *              list goes through. A recipe that does not parse is not a near
 *              miss, it is nothing.
 *   THE POINT- does it contain the beat the script is FOR? A clip that
 *              renders and drops the payoff is worse than one that fails
 *              loudly, and it is the failure nobody notices.
 *   SCREENS  - the sequence of screens, which IS the video. Same screens in
 *              the same order is the same clip.
 *   SECONDS  - how long somebody waits. The reason for picking Flash-Lite
 *              and turning its thinking down, so it is measured rather than
 *              asserted.
 *
 * Whoever runs this holds the keys. They are read from the environment, sent
 * to their own provider and nowhere else, never printed and never written
 * down. The Claude arms cost real money - a few rupees for the lot. The
 * Gemini arm is free.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { askProvider, providerById, castToShape } from './lib/providers.ts';
import { briefingFor } from './lib/briefing.ts';
import { dropImpossible } from './lib/possible.ts';
import { parse } from '../src/recipe.js';
import { catalogue, howToValidate } from '../screens/index.js';

/* The key, from the environment or - failing that - from cf/.dev.vars, which
 * is where the Worker's local copy already lives and which git ignores.
 *
 * Reading the file matters more than it looks. Asking somebody to put a
 * secret in front of a command is asking them to get the syntax right on
 * their own shell - and the bash form I handed over first is a syntax error
 * in PowerShell, which is what this machine runs. It also leaves the key in
 * the shell history. If it is already on disk for the Worker, use that. */
function keyFromDevVars(): string {
  try {
    const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'cf', '.dev.vars'), 'utf8');
    const line = text.split('\n').find(l => l.trim().startsWith('GEMINI_API_KEY'));
    return line ? (line.split('=')[1] ?? '').trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const geminiKey = process.env.GEMINI_API_KEY || keyFromDevVars();

if (!geminiKey) {
  console.error(
    'No Gemini key found. Either put one in cf/.dev.vars as\n' +
    '  GEMINI_API_KEY = "AIza..."\n' +
    'or set it for this terminal first:\n' +
    '  PowerShell:  $env:GEMINI_API_KEY = "AIza..."\n' +
    '  bash:        export GEMINI_API_KEY=AIza...\n' +
    'A free key comes from aistudio.google.com/apikey. It is sent to Google\n' +
    'and nowhere else, and is never printed or written down by this script.'
  );
  process.exit(1);
}

type Arm = {
  label: string;
  free: boolean;
  run: (script: string, shape: string) => Promise<{ recipe: string; dropped: string[] }>;
};

/* One arm. This compared three models while the studio had three to choose
 * between; it has one now, so the question stopped being "which is best" and
 * became "does the one we use do the job". The comparison is in the history
 * if it is ever needed again. */
const MODELS = (process.env.MODELS ?? providerById('gemini').defaultModel).split(',');

const ARMS: Arm[] = MODELS.map(model => ({
  label: model.trim(),
  free: true,
  run: async (script, shape) => {
    /* The real path, not a tidied-up one: the same briefing the studio hands
       anybody pasting into a chat window, and the same shape-casting
       afterwards. An eval of a path nobody uses proves nothing. */
    const { recipe } = await askProvider({
      id: 'gemini', key: geminiKey, model: model.trim(),
      prompt: briefingFor(script, { shape })
    });
    /* The same two repairs the studio makes, in the same order. An eval of a
       path nobody uses proves nothing - but a repair that is counted and not
       SHOWN is worse than that: the score goes up and what the model got
       wrong disappears from the report. So they are printed. */
    return dropImpossible(castToShape(recipe, shape).recipe);
  }
}));

/* The scripts. Eight, chosen to cover what the studio is actually asked for
 * rather than to be easy: both shapes, both products, and the two flows that
 * have cost the most to get right - the laptop share, and the reports. */
const SCRIPTS: { name: string; shape: string; script: string; wants: string[] }[] = [
  {
    name: 'laptop-bill-and-share', shape: 'laptop',
    wants: ['mbb-desktop-invoice', 'wa-web'],
    script:
      'Internal team adds: UI / Open myBillBook and select the business Prime Hardware. ' +
      'Navigate to Create Sales Invoice. Click Add Item and add Cement Bags, TMT Bars and ' +
      'Vitrified Tiles. Ensure the final invoice amount is above 80,000. Click Generate ' +
      'Invoice. Select the Share option. Click the WhatsApp share button. Show the WhatsApp ' +
      'chat screen with the generated invoice ready to share.'
  },
  {
    name: 'phone-bill-and-share', shape: 'phone',
    wants: ['wa-chat'],
    script:
      'Dukaan pe customer khada hai. Main phone uthata hoon, myBillBook kholta hoon, ' +
      'do minute mein bill ban jaata hai aur seedha WhatsApp pe chala jaata hai. ' +
      'Dikhao bill banta hua aur WhatsApp pe jaata hua.'
  },
  {
    name: 'laptop-reports', shape: 'laptop',
    wants: ['mbb-desktop-report-list', 'mbb-desktop-reports'],
    script:
      'Mahine ke end mein hisaab lagane ki zaroorat nahi. myBillBook mein Reports kholo, ' +
      'Profit And Loss pe click karo, pichla mahina choose karo, aur neeche Net Profit dekho. ' +
      'Poora hisaab, do second mein.'
  },
  {
    name: 'phone-takings', shape: 'phone',
    wants: ['profit-loss'],
    script:
      'Poore din mein kitna kamaaya, ye pata karne ke liye ab calculator nahi chahiye. ' +
      'Saare bills dikhao, phir Profit and Loss report kholo aur Net Profit dikhao.'
  },
  {
    name: 'low-stock', shape: 'phone',
    wants: ['low-stock'],
    script:
      'Maal kab khatam ho raha hai pata hi nahi chalta. myBillBook batata hai kaunsa stock ' +
      'kam hai. Items kholo aur Low Stock filter lagao - jo khatam ho raha hai wo laal mein dikhega.'
  },
  {
    name: 'scan-a-bill', shape: 'phone',
    wants: ['scan-done'],
    script:
      'Supplier ka bill type karne ki zaroorat nahi. Bas photo kheencho, app khud padh leta hai ' +
      'aur purchase entry ban jaati hai. Scan and Record dikhao, photo lo, aur bani hui entry dikhao.'
  },
  {
    name: 'udhaar-recovery', shape: 'phone',
    wants: ['mcf-dashboard'],
    script:
      'Market mein mera 52 lakh atka hua hai aur din bhar phone karte raho. myCashFlo khud ' +
      'yaad dilata hai. Dashboard dikhao jisme 52 lakh atka hua ho, phir jo customer nahi de ' +
      'raha uska page, aur automation on karte hue dikhao.'
  },
  {
    name: 'festive-theme', shape: 'phone',
    wants: ['theme-store'],
    script:
      'Diwali aa rahi hai. Bill pe festive theme laga sakte ho. Bill banne ke baad theme store ' +
      'kholo, Diwali wala theme choose karo, aur themed bill dikhao.'
  }
];

const only = process.argv.includes('--one')
  ? Number(process.argv[process.argv.indexOf('--one') + 1])
  : null;
const chosen = only == null ? SCRIPTS : [SCRIPTS[only]].filter(Boolean);

/* --raw prints the recipe behind a verdict, which is the thing you need the
 * moment a verdict is bad. */
const raw = process.argv.includes('--raw');
const indent = (text: string) =>
  text.trimEnd().split('\n').map(l => '      | ' + l).join('\n') + '\n';

/* The studio's own validator, called the way the studio calls it.
 *
 * This used to be `parse(yamlText)` with no catalogue, and parse takes the
 * catalogue as its SECOND argument - so every script in the run came back
 * "DID NOT PARSE: Cannot convert undefined or null to object" and the report
 * read 0/8. That is a JavaScript error from inside the harness wearing the
 * costume of a verdict on the model, which is the worst thing a measurement
 * can do: it was about to be evidence for a decision about which AI to use. */
function readRecipe(yamlText: string): { screens: string[]; warnings: string[] } {
  /* howToValidate, not a hand-made options object. This passed `scrollable`
   * and not `zoomable`, so zooms were checked against tap targets alone -
   * stricter than the studio, which allows a zoom to anywhere a screen names
   * for looking at. It refused a recipe that renders and the report called it
   * the model inventing a label. Twice now this harness has produced a
   * verdict about the model out of its own difference from production. */
  const { recipe, errors, warnings } = parse(yamlText, catalogue(), howToValidate());
  /* A recipe the studio would refuse is a failure, and WHY it refused is the
     useful half - "no such screen: foo" says what the model got wrong. */
  if (errors?.length) throw new Error(errors.join('; '));
  return {
    screens: recipe.shots.map((s: { screen: string }) => s.screen),
    /* The studio's own verdict on whether a clip is any good to WATCH, which
     * this used to throw on the floor.
     *
     * "Parsed" and "kept the point" both say yes to a clip with a beat
     * nobody can read, three seconds of dead air, or two taps 0.3s apart -
     * so the report said 7/8 while the shot lists coming out were not crisp,
     * and there was nothing in the table to disagree with. These warnings
     * are exactly that judgement, already written and already tuned against
     * real clips: dead air, beats too quick to follow, shots too short to
     * register, a clip that runs long, a cut between a laptop and a phone.
     * Counting them is free and it is the measure that was missing. */
    warnings: (warnings ?? []) as string[]
  };
}

type Tally = { parsed: number; kept: number; seconds: number; failed: string[]; dropped: number; notes: number };
const tally: Record<string, Tally> = {};
for (const a of ARMS) tally[a.label] = { parsed: 0, kept: 0, seconds: 0, failed: [], dropped: 0, notes: 0 };

/* The harness checks ITSELF before it judges anything.
 *
 * The first run of this reported 0/8 - "DID NOT PARSE" on every script - and
 * it was not the model. parse() takes the screen catalogue as its second
 * argument and was being called without it, so every recipe died inside the
 * harness and the report blamed Gemini in a table somebody was about to make
 * a decision from. A measurement that can fail silently in its own favour is
 * worse than no measurement.
 *
 * So the repo's own recipes go through the same path first. They are known
 * good - they render - so anything wrong here is the harness.
 *
 * It ran ONE recipe at first, and that recipe's only zoom happened to land
 * on a tap target - so it sailed through while the harness was refusing
 * every zoom to a look-at-only place, and the report blamed the model for
 * inventing labels. Now it runs all of them, which costs nothing and covers
 * the whole vocabulary rather than one corner of it. */
try {
  const dir = join(HERE, '..', 'recipes');
  const names = readdirSync(dir).filter(n => n.endsWith('.yaml'));
  if (names.length < 10) throw new Error(`only found ${names.length} recipes to check against`);

  const broken = names
    .map(name => {
      try {
        if (!readRecipe(readFileSync(join(dir, name), 'utf8')).screens.length) {
          throw new Error('no screens');
        }
        return null;
      } catch (err) {
        return `${name}: ${(err as Error).message}`;
      }
    })
    .filter(Boolean);

  if (broken.length) throw new Error(broken.join('\n  '));
} catch (err) {
  console.error(
    '\nThe harness is broken, so nothing was asked of any model and nothing\n' +
    'was spent. A recipe from this repo, which renders, did not survive the\n' +
    'eval\'s own path:\n\n  ' + (err as Error).message + '\n\n' +
    'Fix that before reading anything into a score.\n'
  );
  process.exit(1);
}

console.log(`\n${chosen.length} script(s) through ${ARMS.length} model(s).\n`);

for (const t of chosen) {
  console.log(`${t.name}  (${t.shape})`);

  for (const arm of ARMS) {
    const started = Date.now();
    let answer: { recipe: string; dropped: string[] };
    try {
      answer = await arm.run(t.script, t.shape);
    } catch (err) {
      const seconds = (Date.now() - started) / 1000;
      tally[arm.label].seconds += seconds;
      tally[arm.label].failed.push(t.name);
      console.log(`  ${arm.label.padEnd(26)} FAILED  ${(err as Error).message.slice(0, 120)}`);
      continue;
    }
    const seconds = (Date.now() - started) / 1000;
    tally[arm.label].seconds += seconds;

    const { recipe, dropped } = answer;
    tally[arm.label].dropped += dropped.length;

    let screens: string[];
    let notes: string[] = [];
    try {
      ({ screens, warnings: notes } = readRecipe(recipe));
      tally[arm.label].parsed++;
      tally[arm.label].notes += notes.length;
    } catch (err) {
      tally[arm.label].failed.push(t.name);
      console.log(`  ${arm.label.padEnd(26)} DID NOT PARSE  ${(err as Error).message.slice(0, 100)}`);
      /* Knowing a recipe was refused is half the story; fixing it needs the
         text that was refused. Without this the only way to see it was to
         write a throwaway script that re-ran the same call by hand. */
      if (raw) console.log(indent(recipe));
      continue;
    }

    const missing = t.wants.filter(w => !screens.includes(w));
    if (!missing.length) tally[arm.label].kept++;

    console.log(
      `  ${arm.label.padEnd(26)} ${seconds.toFixed(1)}s  ${screens.join(' > ')}` +
      `${missing.length ? `\n  ${' '.repeat(26)} MISSING THE POINT: ${missing.join(', ')}` : ''}` +
      /* What the studio repaired to get this far. Counted in the table AND
         printed here, because a repair that only shows up as a better score
         is the model's mistake going quiet. */
      dropped.map(d => `\n  ${' '.repeat(26)} DROPPED: ${d}`).join('') +
      /* The studio's own complaints about the clip as a thing to watch. This
         is the difference between a recipe that is valid and one that is
         good, and it is the column that was missing while the table said
         7/8 about shot lists that were not crisp. */
      notes.map(n => `\n  ${' '.repeat(26)} ROUGH: ${n}`).join('') +
      /* The screens tell you the shape of the clip; they say nothing about
         whether it is any good to watch. For that you have to read it. */
      (raw ? '\n' + indent(recipe) : '')
    );
  }
  console.log('');
}

console.log('-'.repeat(74));
console.log(
  `  ${'model'.padEnd(26)} ${'parsed'.padEnd(8)} ${'kept the point'.padEnd(16)} ` +
  `${'repaired'.padEnd(10)} ${'rough'.padEnd(8)} avg seconds`
);
for (const arm of ARMS) {
  const s = tally[arm.label];
  console.log(
    `  ${arm.label.padEnd(26)} ${`${s.parsed}/${chosen.length}`.padEnd(8)} ` +
    `${`${s.kept}/${chosen.length}`.padEnd(16)} ${String(s.dropped).padEnd(10)} ` +
    `${String(s.notes).padEnd(8)} ` +
    `${(s.seconds / chosen.length).toFixed(1)}${arm.free ? '   (free)' : ''}`
  );
}
console.log(
  '\n  A different screen list is not automatically worse - read the lines\n' +
  '  above and decide. "MISSING THE POINT" always is: that is the beat the\n' +
  '  script was written for, dropped from a clip that still renders.\n\n' +
  '  "repaired" is how many details the studio took out to get these to\n' +
  '  parse at all - a zoom to a label no screen has, a tap on the wrong\n' +
  '  screen. The clip is still made and the person is told what went. It is\n' +
  '  the honest measure of how often the model invents a word, so it belongs\n' +
  '  beside the score rather than hidden inside it.\n'
);
