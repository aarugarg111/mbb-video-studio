/* The spoken lines in a clip, with the second each one lands on.
 *
 * The clips are silent on purpose: the creator records the Hinglish voiceover
 * over them. But one thing in them IS spoken dialogue - the AI's half of a
 * myCashFlo follow-up call - and whoever records or generates that voice needs
 * to know exactly when each line is due, or it drifts out of step with the
 * words appearing on screen.
 *
 * So the render writes the lines out beside the video rather than burning a
 * voice into it. Nothing new to pay for, nothing to sign up to, and the clip
 * still drops into a creator's edit as silent footage.
 *
 * Timings are absolute: seconds from the start of the whole clip, counted the
 * way the timeline counts them, so a shot moving earlier moves its lines too.
 */

import { SCREENS } from '../screens/index.js';

/* How long a line stays up. A spoken Hinglish sentence of this length runs a
 * little under three seconds, and a caption that leaves before the voice does
 * reads as a mistake. */
const LINE_SECONDS = 2.8;

/* Where each shot begins. The timeline locates a moment by walking the shots
 * and subtracting as it goes, so this walks them the same way - one source of
 * truth for when a shot starts. */
export function shotStarts(recipe) {
  const starts = [];
  let elapsed = 0;
  for (const shot of recipe?.shots ?? []) {
    starts.push(elapsed);
    elapsed += Number(shot.duration) || 0;
  }
  return starts;
}

/* Every line spoken in the clip, in order.
 *
 * `voiced` marks the ones a voice is generated for. The party's replies are
 * listed too, because a creator leaving a gap for an answer needs to know how
 * long the gap is - but nobody generates a voice for them. */
export function voiceLines(recipe) {
  const starts = shotStarts(recipe);
  const lines = [];

  (recipe?.shots ?? []).forEach((shot, i) => {
    const screen = SCREENS[shot.screen];
    const transcript = screen?.TRANSCRIPT;
    if (!Array.isArray(transcript)) return;

    const start = starts[i];
    const endOfShot = start + (Number(shot.duration) || 0);

    for (const line of transcript) {
      const at = start + line.at;
      /* A line the shot is too short to reach would be written down and never
       * seen, which is worse than not writing it: somebody would record it. */
      if (at >= endOfShot) continue;
      lines.push({
        at,
        until: Math.min(at + LINE_SECONDS, endOfShot),
        speaker: line.who === 'ai' ? 'myCashFlo AI' : partyName(recipe),
        text: line.text,
        voiced: line.who === 'ai'
      });
    }
  });

  return lines.sort((a, b) => a.at - b.at);
}

function partyName(recipe) {
  return recipe?.party?.name || 'Customer';
}

/* hh:mm:ss,mmm - what every editor and caption tool reads. */
export function timecode(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const ms = Math.round((total % 1) * 1000);
  const whole = Math.floor(total);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)},${pad(ms, 3)}`;
}

/* A subtitle file. It opens in Premiere, Resolve, CapCut and every voice tool
 * worth using, so it is one file rather than a format of our own. */
export function toSrt(lines) {
  return lines
    .map((line, i) =>
      `${i + 1}\n${timecode(line.at)} --> ${timecode(line.until)}\n${line.speaker}: ${line.text}\n`)
    .join('\n');
}

/* The same thing for a person to read, marking what actually needs a voice. */
export function toScript(lines) {
  if (!lines.length) return '';
  const at = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return [
    'Spoken lines in this clip.',
    'Only the lines marked VOICE need a recording - the rest are the other',
    'side of the call, listed so you know how long a gap to leave.',
    '',
    ...lines.map(l => `${at(l.at).padStart(5)}  ${l.voiced ? 'VOICE' : '     '}  ${l.speaker}: ${l.text}`)
  ].join('\n');
}
