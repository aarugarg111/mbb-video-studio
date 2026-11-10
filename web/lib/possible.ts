/* Dropping what the renderer cannot do, instead of refusing the script.
 *
 * The AI reads a script into a fixed vocabulary of screens, and now and then
 * it invents one word of that vocabulary - a zoom to "invoice-date" on a
 * screen that has no such label. The validator caught it and refused the
 * whole recipe, which meant one invented word cost an entire shot list over
 * a camera move nobody had asked for by name. Measuring the free tier turned
 * that up as the last failure standing: not a model that cannot do the job,
 * a studio with no tolerance for a flourish.
 *
 * So the impossible parts come out here and the clip still gets made. Three
 * rules this follows, and they are the whole design:
 *
 *   It is REPORTED, never quietly dropped. Same as the shape-recasting next
 *   door: whoever is checking the shot list is the one who can say whether
 *   it mattered, and they cannot say that about something they were not
 *   told. A silent repair is how a clip goes out missing its payoff.
 *
 *   Only DETAILS, never the video. An action is emphasis or a step within a
 *   screen; the screens themselves are what the video IS. A shot naming a
 *   screen that does not exist is still refused, because there is nothing to
 *   draw and nothing to drop that would leave the clip intact.
 *
 *   Only at the BOUNDARY, on what an AI proposed. The validator stays
 *   strict for everything else. A typo in a recipe somebody is writing by
 *   hand should be pointed at, not swallowed - they are sitting there, able
 *   to fix it, and being told is the fastest way.
 */
import yaml from 'js-yaml';
import { catalogue, zoomCatalogue, scrollables } from '../../screens/index.js';

type Action = { do?: unknown; target?: unknown; at?: unknown };
type Shot = { screen?: unknown; actions?: unknown };

/* Where the action was, in the words the validator uses, so a note here and
 * an error there read as the same studio talking. */
const place = (shotIndex: number, actionIndex: number) =>
  `shot ${shotIndex + 1}, action ${actionIndex + 1}`;

export function dropImpossible(recipeText: string): { recipe: string; dropped: string[] } {
  let doc: { shots?: unknown } | null;
  try {
    doc = yaml.load(recipeText) as { shots?: unknown } | null;
  } catch {
    /* Unreadable YAML is exactly the recipe somebody needs to see, and the
       validator describes it far better than this could. */
    return { recipe: recipeText, dropped: [] };
  }
  if (!doc || !Array.isArray(doc.shots)) return { recipe: recipeText, dropped: [] };

  const taps = catalogue() as Record<string, string[]>;
  const zooms = zoomCatalogue() as Record<string, string[]>;
  const scrolls = scrollables() as string[];
  const dropped: string[] = [];

  for (const [i, shotValue] of (doc.shots as unknown[]).entries()) {
    const shot = shotValue as Shot;
    const screen = typeof shot?.screen === 'string' ? shot.screen : null;
    /* An invented screen is left exactly as it came. The validator refuses
       it, which is right: there is no version of this clip without it. */
    if (!screen || !Object.hasOwn(taps, screen)) continue;
    if (!Array.isArray(shot.actions)) continue;

    shot.actions = (shot.actions as unknown[]).filter((actionValue, j) => {
      const action = actionValue as Action;
      const did = action?.do;
      const target = action?.target;
      const at = place(i, j);

      if (did === 'scroll' && !scrolls.includes(screen)) {
        dropped.push(
          `${at}: the ${screen} screen has nothing long enough to scroll, so that ` +
          'scroll is left out - it would have played as a moment where nothing moves'
        );
        return false;
      }

      if (typeof target !== 'string') return true;   // zoomOut and friends carry none

      if (did === 'zoom' && !(zooms[screen] ?? []).includes(target)) {
        dropped.push(
          `${at}: the ${screen} screen has nowhere called "${target}" to zoom to, so ` +
          'that zoom is left out and the shot plays without it'
        );
        return false;
      }

      if ((did === 'tap' || did === 'type') && !(taps[screen] ?? []).includes(target)) {
        /* Where it actually lives, same as the validator says it. Naming a
           button from a DIFFERENT screen is the commonest way this goes
           wrong, and it is the one case where the note tells somebody
           something they can act on. */
        const elsewhere = Object.entries(taps)
          .filter(([name, list]) => name !== screen && list.includes(target))
          .map(([name]) => name);
        dropped.push(
          `${at}: "${target}" is not on the ${screen} screen, so that ${did} is left out` +
          (elsewhere.length ? ` - it is on ${elsewhere.join(', ')}` : '')
        );
        return false;
      }

      return true;
    });
  }

  /* Nothing to do means nothing is rewritten. Dumping a recipe that did not
     need changing would hand somebody a page of re-indented YAML they did
     not write, for no reason. */
  if (!dropped.length) return { recipe: recipeText, dropped: [] };
  return { recipe: yaml.dump(doc), dropped };
}
