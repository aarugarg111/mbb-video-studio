/* A customer's problem in, a narrated demo video out.
 *
 *   npm run help -- "customer can't find how to add a new party"
 *   npm run help -- "wants to see who owes him money" --laptop
 *
 * This is the Customer Support path, end to end: what the agent types, the
 * shot list, the render, the voice, the captions. One free API call; the rest
 * is the studio's own deterministic code and ffmpeg.
 *
 * WHY A COMMAND AND NOT A BUTTON IN THE STUDIO.
 *
 * The voice is the reason, and it is worth writing down because it looks
 * arbitrary. The studio renders in the browser, and the browser cannot put a
 * voice in the file: its encoder has no audio track, and the Web Speech API
 * speaks to the speakers rather than handing over bytes to mux. A voiced clip
 * needs ffmpeg, which means this machine or a render service - and the render
 * service has never been deployed.
 *
 * So the query-to-recipe half, which is the new thinking, lives in lib/ where
 * the studio can use it the moment there is somewhere to render with sound.
 * This command is the half that works today.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { askProvider, providerById } from './lib/providers.ts';
import { briefingFor } from './lib/briefing.ts';
import { dropImpossible } from './lib/possible.ts';
import { parse } from '../src/recipe.js';
import { catalogue, howToValidate } from '../screens/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function keyFromDevVars(): string {
  try {
    const text = readFileSync(join(ROOT, 'cf', '.dev.vars'), 'utf8');
    const line = text.split(/\r?\n/).find(l => l.trim().startsWith('GEMINI_API_KEY'));
    return line ? (line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')) : '';
  } catch {
    return '';
  }
}

const args = process.argv.slice(2);
const problem = args.filter(a => !a.startsWith('--')).join(' ').trim();
const shape = args.includes('--laptop') ? 'laptop' : 'phone';
const silent = args.includes('--silent');

if (!problem) {
  console.error(
    'Usage: npm run help -- "what the customer is stuck on"\n' +
    '  --laptop   film it on the desktop screens instead of a phone\n' +
    '  --silent   stop after the video, without adding the voice\n\n' +
    'Needs GEMINI_API_KEY in cf/.dev.vars or in the environment, and ffmpeg\n' +
    'on PATH or in FFMPEG.'
  );
  process.exit(1);
}

const key = process.env.GEMINI_API_KEY || keyFromDevVars();
if (!key) {
  console.error('No Gemini key. Put one in cf/.dev.vars as GEMINI_API_KEY = "..." - it is free.');
  process.exit(1);
}

console.log(`\n${problem}\n`);
process.stdout.write('  asking... ');

const started = Date.now();
const answered = await askProvider({
  id: 'gemini',
  key,
  model: providerById('gemini').defaultModel,
  prompt: briefingFor(problem, { shape, mode: 'help' })
});
console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);

const { recipe: text, dropped } = dropImpossible(answered.recipe);
for (const note of [...answered.unsupported, ...dropped]) console.log(`  note: ${note}`);

/* The studio's own validator, before anything is rendered. A recipe that
 * will not parse has to be seen, not summarised. */
const { recipe, errors, warnings } = parse(text, catalogue(), howToValidate()) as
  { recipe?: any; errors?: string[]; warnings?: string[] };

if (errors?.length) {
  console.error('\n  The shot list did not survive the validator:\n');
  for (const e of errors) console.error('    ' + e);
  console.error('\n  What it answered:\n');
  console.error(text.replace(/^/gm, '    '));
  process.exit(1);
}
/* One warning is not "rough", it is "do not send this".
 *
 * A clip whose voice names a different button from the one the finger presses
 * teaches the customer the wrong thing, and it looks completely fine while
 * doing it. Printed apart from the pacing notes so it cannot be skimmed past
 * in a list of six. */
const wrongButton = (warnings ?? []).filter(w => /teaches the wrong thing/.test(w));
for (const w of (warnings ?? []).filter(w => !wrongButton.includes(w))) {
  console.log(`  rough: ${w}`);
}
if (wrongButton.length) {
  console.log('\n  ----------------------------------------------------------------');
  console.log('  DO NOT SEND THIS CLIP YET.\n');
  for (const w of wrongButton) console.log('  ' + w);
  console.log(
    '\n  It will still be built, so you can watch it and see which half is\n' +
    '  wrong - but as it stands it tells the customer to press something\n' +
    '  other than what it shows being pressed.'
  );
  console.log('  ----------------------------------------------------------------');
}

const spoken = (recipe.shots ?? []).flatMap((s: any) => s.say ?? []);
if (!spoken.length) {
  console.error(
    '\n  Nothing in this clip is spoken, so it is not a help video - it is a\n' +
    '  silent demo. That is the model ignoring the instruction to narrate.\n' +
    '  Run it again; if it keeps happening the briefing needs the fix, not\n' +
    '  the clip.'
  );
  process.exit(1);
}

/* Named after the recipe's own "video", because that is what the renderer
 * names its output folder after. Inventing a second name here meant writing
 * the shot list to one folder and then looking for the rendered file in
 * another - which is exactly what happened the first time this ran. */
const slug = String(recipe.video ?? 'help').trim();
const dir = join(ROOT, 'out', slug);
mkdirSync(dir, { recursive: true });
const recipePath = join(dir, `${slug}.yaml`);
writeFileSync(recipePath, `# ${problem}\n#\n# Written by the studio from that line. Check it before sending.\n\n${text}`);
console.log(`\n  ${recipePath}`);

/* Rendering and narrating are the commands they already are, called rather
 * than reimplemented - so a clip made here and one made by hand cannot differ. */
const node = process.execPath;
const quiet = { cwd: ROOT, stdio: 'inherit' as const };

console.log('\n  rendering...');
execFileSync(node, [join(ROOT, 'worker', 'cli.js'), recipePath], quiet);

if (!silent) {
  console.log('\n  adding the voice...');
  execFileSync(node, [
    join(ROOT, 'worker', 'narrate.js'),
    recipePath,
    join(dir, `${slug}.mp4`)
  ], quiet);
}

console.log(`\n  Ready to send: ${join(dir, `${slug}${silent ? '' : '-voiced'}.mp4`)}\n`);
