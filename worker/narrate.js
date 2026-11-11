#!/usr/bin/env node
/* Putting the AI's voice into a clip, at the seconds it is already due.
 *
 *   node worker/narrate.js <recipe.yaml> <clip.mp4> [out.mp4]
 *
 * The clips are silent on purpose - a creator records their own Hinglish
 * voiceover over them, and burning a voice in would take that choice away.
 * One thing in them is different: the myCashFlo follow-up call, where the AI
 * speaking IS the product being demonstrated. A silent clip of an AI phone
 * call is a clip of a phone.
 *
 * So this is a step somebody asks for, not part of the render. The render
 * stays silent, deterministic and byte-identical run to run; this takes its
 * output and lays a voice over it.
 *
 * Nothing is paid for and nothing is downloaded. The voice is the one already
 * on the machine - Windows' own speech synthesiser, which every Windows
 * install has. That also sets the honest limit of this first version: the
 * voices installed here are English, and these lines are Hinglish, so the
 * accent is wrong. It proves the plumbing - that a voice can be placed on the
 * exact second the words appear on screen - which is the part that could have
 * failed. The voice itself is a swap: a Hindi voice, or Piper, drops into
 * speak() without anything else here changing.
 *
 * WHICH lines: only the ones voiceLines() marks `voiced`, which is the AI's
 * half. The customer's half is a real person on a real call; synthesising
 * both would be putting words in a human's mouth.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from './compile.js';
import { voiceLines, shotStarts } from '../src/voiceover.js';
import { totalDuration } from '../src/timeline.js';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));

/* ffmpeg, wherever this machine keeps it. The render already has to find it,
 * so the same environment variable works here. */
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

/* One line of speech to a wav, using the synthesiser Windows ships with.
 *
 * Done through PowerShell because that is how System.Speech is reachable
 * without installing anything. The text goes in as a single-quoted
 * PowerShell string with its own quotes doubled - these lines are Hinglish
 * and contain apostrophes, and an unescaped one would end the string and
 * turn the rest of a sentence into commands. */
async function speak(text, outPath, { voice, rate = 0 } = {}) {
  const quoted = String(text).replace(/'/g, "''");
  const pick = voice ? `$s.SelectVoice('${voice.replace(/'/g, "''")}');` : '';
  const script =
    `Add-Type -AssemblyName System.Speech; ` +
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    `${pick}` +
    `$s.Rate = ${Number(rate) | 0}; ` +
    `$s.SetOutputToWaveFile('${outPath.replace(/'/g, "''")}'); ` +
    `$s.Speak('${quoted}'); ` +
    `$s.Dispose();`;

  await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

/* How long a wav runs, so a line that overruns the next one can be reported
 * rather than quietly talking over it. */
async function secondsOf(path) {
  const probe = process.env.FFPROBE ?? FFMPEG.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'));
  const { stdout } = await run(probe, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path
  ]);
  return Number(String(stdout).trim()) || 0;
}

/* What is wrong with a set of lines once their real spoken lengths are known.
 *
 * Separate from the synthesising and the muxing, and pure, because this is
 * the part worth being sure about: it needs no voice, no ffmpeg and no
 * machine that happens to have a synthesiser on it, so it can be tested.
 *
 * `at` and `length` are seconds; `shotEnds` is when the picture cuts away
 * from the screen the line belongs to. The tolerance is a frame or so - a
 * line landing 10ms long is not worth a sentence about. */
export function troublesWith(lines, clipSeconds, slack = 0.05) {
  const said = [];

  lines.forEach((line, i) => {
    const ends = line.at + line.length;
    const next = lines[i + 1];

    if (next && ends > next.at + slack) {
      said.push(
        `line ${i + 1} runs ${line.length.toFixed(1)}s from ${line.at}s and the next is due ` +
        `at ${next.at}s - they will overlap. Slow the shot down or shorten the line.`
      );
    }

    /* Past the end of its OWN SHOT is the one that matters, and it is not the
     * same as running past the clip. The screen has already cut away, so the
     * voice carries on over whatever came next - audio belonging to the wrong
     * picture. This is how the AI call screen turned out to need more than
     * the 9s its own note claimed: that note was a guess at how long a line
     * takes to say, and a real voice takes longer. */
    const overrun = ends - line.shotEnds;
    if (Number.isFinite(line.shotEnds) && overrun > slack) {
      said.push(
        `line ${i + 1} runs ${overrun.toFixed(1)}s past the end of its shot. The clip has cut ` +
        'away by then, so the voice plays over the next screen. Give that shot at least ' +
        `${(line.shotSeconds + overrun).toFixed(1)}s.`
      );
    }

    if (Number.isFinite(clipSeconds) && ends > clipSeconds + slack) {
      said.push(`line ${i + 1} runs past the end of the clip (${clipSeconds.toFixed(1)}s).`);
    }
  });

  return said;
}

export async function narrate(recipeText, clipPath, outPath, opts = {}) {
  const { recipe, errors } = await compile(recipeText);
  if (errors?.length) throw new Error(`The recipe does not parse:\n  ${errors.join('\n  ')}`);

  /* Which shot each line belongs to, so an overrun can be measured against
   * the moment the picture cuts away rather than against the whole clip.
   * voiceLines() reports absolute seconds and nothing about shots, so the
   * bounds are rebuilt here from the same shotStarts it used. */
  const starts = shotStarts(recipe);
  const bounds = (recipe?.shots ?? []).map((shot, i) => ({
    from: starts[i],
    to: starts[i] + (Number(shot.duration) || 0),
    seconds: Number(shot.duration) || 0
  }));
  const shotOf = at => bounds.find(b => at >= b.from && at < b.to) ?? bounds[bounds.length - 1];

  const spoken = voiceLines(recipe).filter(l => l.voiced).map(l => {
    const shot = shotOf(l.at);
    return { ...l, shotEnds: shot?.to ?? 0, shotSeconds: shot?.seconds ?? 0 };
  });
  if (!spoken.length) {
    throw new Error(
      'Nothing in this clip is spoken dialogue, so there is nothing to narrate. ' +
      'Only the myCashFlo AI call screen carries lines - the rest of a clip is ' +
      'silent on purpose, for the creator to voice.'
    );
  }

  const work = join(HERE, '..', '.voice-tmp');
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });

  const clipSeconds = totalDuration(recipe);
  const placed = [];

  for (const [i, line] of spoken.entries()) {
    const wav = join(work, `line-${i}.wav`);
    await speak(line.text, wav, opts);
    placed.push({ ...line, wav, length: await secondsOf(wav) });
  }

  for (const trouble of troublesWith(placed, clipSeconds)) console.warn('  ' + trouble);

  /* One pass: the video, every line delayed to its own second, mixed into a
   * single track. adelay takes milliseconds and needs one value per channel.
   * normalize=0 keeps amix from quietening everything just because there are
   * several inputs - the lines do not overlap, so there is nothing to
   * balance, and normalising makes a two-line clip half as loud as a one. */
  const inputs = ['-i', clipPath];
  for (const p of placed) inputs.push('-i', p.wav);

  const chains = placed.map((p, i) =>
    `[${i + 1}:a]adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`
  );
  /* apad, and it is not optional.
   *
   * The mixed track ends when the last line stops talking. Without padding
   * it to the full length, "-shortest" takes the VIDEO down to the length of
   * the audio: the first run of this produced a 16.7s file from a 25.8s clip
   * and cut nine seconds off the end, the payoff among them. A clip quietly
   * losing its ending is exactly the kind of damage nobody notices until it
   * is published. Padded with silence, "-shortest" now stops at the video,
   * which is what it was there for. */
  const mix =
    placed.map((_, i) => `[a${i}]`).join('') +
    `amix=inputs=${placed.length}:normalize=0,apad[out]`;

  const args = [
    '-y', ...inputs,
    '-filter_complex', [...chains, mix].join(';'),
    '-map', '0:v', '-map', '[out]',
    '-c:v', 'copy',            // the picture is untouched - no re-encode, no loss
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    outPath
  ];
  await run(FFMPEG, args, { maxBuffer: 1 << 26 });

  await rm(work, { recursive: true, force: true });
  return { lines: placed.map(p => ({ at: p.at, seconds: p.length, text: p.text })), outPath };
}

async function main() {
  const [recipePath, clipPath, outArg] = process.argv.slice(2);
  if (!recipePath || !clipPath) {
    console.error(
      'Usage: node worker/narrate.js <recipe.yaml> <clip.mp4> [out.mp4]\n' +
      '  Lays the myCashFlo AI call voice onto an already-rendered clip.\n' +
      '  FFMPEG=<path> if ffmpeg is not on PATH. VOICE=<name> to pick a voice.'
    );
    process.exit(1);
  }

  const out = outArg ?? join(
    dirname(clipPath),
    `${basename(clipPath, extname(clipPath))}-voiced.mp4`
  );

  const { lines } = await narrate(await readFile(recipePath, 'utf8'), clipPath, out, {
    voice: process.env.VOICE,
    rate: process.env.VOICE_RATE
  });

  console.log(`\n${out}\n`);
  for (const l of lines) {
    console.log(`  ${l.at.toFixed(1)}s  (${l.seconds.toFixed(1)}s)  ${l.text}`);
  }
  console.log('\nThe voice is the one installed on this machine. These lines are');
  console.log('Hinglish, so the accent is wrong - what this shows is that a voice');
  console.log('lands on the same second the words appear on screen.\n');
}

if (process.argv[1] && process.argv[1].endsWith('narrate.js')) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}
