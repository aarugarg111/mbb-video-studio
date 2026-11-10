/* Does the cheap model write as good a shot list as the dear one?
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx eval.mts            (from web/)
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx eval.mts --one 3    (just one script)
 *
 * The studio's whole bill is one call per script, and it was on Opus. Moving
 * it to Haiku is only worth doing if the shot lists hold up, and "I think
 * they will" is not a reason to change what the team's videos are made with.
 * So this puts the SAME scripts through both and prints the difference.
 *
 * It does not score with another model, and it does not ask anybody to read
 * two YAML files side by side. Three things decide it, and all three are
 * things the studio already knows how to check:
 *
 *   PARSES   - the recipe survives src/recipe.js, which is the same gate a
 *              hand-written one goes through. A recipe that does not parse is
 *              not a near miss, it is nothing.
 *   SCREENS  - the sequence of screens, which IS the video. Two recipes with
 *              the same screens in the same order are the same clip; a
 *              different screen list is a different clip, whatever else matches.
 *   TAPS     - what gets pressed on each one. The same screens tapped in
 *              different places is the same clip done wrong.
 *
 * Whoever runs this holds the key. It is read from the environment and goes
 * to Anthropic and nowhere else - this file never prints it and never writes
 * it down.
 *
 * It costs real money to run: two calls per script, one of them on Opus. At
 * eight scripts that is small change, but it is not nothing, and it is the
 * last Opus money the studio should ever need to spend.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { proposeRecipe, MODEL } from './lib/claude.ts';
import { parse } from '../src/recipe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEAR = 'claude-opus-5-5';
const CHEAP = MODEL;

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error(
    'Set ANTHROPIC_API_KEY first. It is read from the environment, sent to\n' +
    'Anthropic and nowhere else, and never written down by this script.'
  );
  process.exit(1);
}

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

/* The two things that make a shot list the clip it is. */
const screensOf = (yamlText: string) => {
  const { recipe } = parse(yamlText);
  return recipe.shots.map((s: { screen: string }) => s.screen);
};
const tapsOf = (yamlText: string) => {
  const { recipe } = parse(yamlText);
  return recipe.shots.flatMap((s: { screen: string; actions?: { do: string; target?: string }[] }) =>
    (s.actions ?? []).filter(a => a.do === 'tap').map(a => `${s.screen}/${a.target}`));
};

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

async function run(model: string, script: string, shape: string) {
  const started = Date.now();
  try {
    const { recipe } = await proposeRecipe({
      apiKey: key, script, model, details: { shape }
    });
    return { ok: true as const, recipe, seconds: (Date.now() - started) / 1000 };
  } catch (err) {
    return { ok: false as const, why: (err as Error).message, seconds: (Date.now() - started) / 1000 };
  }
}

const rows: string[] = [];
let agreed = 0, cheapParsed = 0, cheapHadWants = 0;

for (const t of chosen) {
  process.stdout.write(`\n${t.name} (${t.shape})\n`);

  const [cheap, dear] = await Promise.all([
    run(CHEAP, t.script, t.shape),
    run(DEAR, t.script, t.shape)
  ]);

  if (!cheap.ok) {
    console.log(`  CHEAP FAILED  ${cheap.why}`);
    rows.push(`${t.name.padEnd(24)} cheap failed`);
    continue;
  }
  if (!dear.ok) {
    console.log(`  (the dear one failed: ${dear.why} - comparing against nothing)`);
  }

  let cheapScreens: string[] = [], cheapTaps: string[] = [];
  try {
    cheapScreens = screensOf(cheap.recipe);
    cheapTaps = tapsOf(cheap.recipe);
    cheapParsed++;
  } catch (err) {
    console.log(`  CHEAP DID NOT PARSE  ${(err as Error).message}`);
    rows.push(`${t.name.padEnd(24)} cheap did not parse`);
    continue;
  }

  /* Did it put the beat in that the script is FOR? A clip that renders and
     leaves out the payoff is worse than one that fails loudly. */
  const missing = t.wants.filter(w => !cheapScreens.includes(w));
  if (!missing.length) cheapHadWants++;

  let verdict = 'no comparison';
  if (dear.ok) {
    try {
      const dearScreens = screensOf(dear.recipe);
      const dearTaps = tapsOf(dear.recipe);
      const screensMatch = same(cheapScreens, dearScreens);
      const tapsMatch = same(cheapTaps, dearTaps);
      if (screensMatch && tapsMatch) { verdict = 'identical'; agreed++; }
      else if (screensMatch) verdict = 'same screens, different taps';
      else verdict = 'different screens';
      console.log(`  cheap: ${cheapScreens.join(' -> ')}`);
      console.log(`  dear : ${dearScreens.join(' -> ')}`);
    } catch {
      verdict = 'the dear one did not parse';
    }
  } else {
    console.log(`  cheap: ${cheapScreens.join(' -> ')}`);
  }

  console.log(
    `  ${verdict}${missing.length ? `  | MISSING THE POINT: ${missing.join(', ')}` : ''}` +
    `  | ${cheap.seconds.toFixed(1)}s vs ${dear.seconds.toFixed(1)}s`
  );
  rows.push(
    `${t.name.padEnd(24)} ${verdict.padEnd(30)}${missing.length ? 'missing ' + missing.join(',') : ''}`
  );
}

console.log(`\n${'-'.repeat(72)}`);
for (const r of rows) console.log('  ' + r);
console.log(
  `\n  ${cheapParsed}/${chosen.length} parsed, ` +
  `${cheapHadWants}/${chosen.length} kept the beat the script is for, ` +
  `${agreed}/${chosen.length} identical to ${DEAR}.`
);
console.log(
  '\n  "different screens" is not automatically worse - look at the two lines\n' +
  '  above it and decide. "MISSING THE POINT" always is.\n'
);
