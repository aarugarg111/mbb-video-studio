/* Parses and validates a recipe before anything slow happens.
 *
 * Errors make rendering impossible and stop the run. Warnings are things the
 * author may have meant, so they render anyway. Both name the shot by index,
 * because that is how a person finds the line in the file.
 */

import yaml from 'js-yaml';
import { DEFAULT_INVOICE } from './invoice.js';

export const DEFAULT_END_CARD = { duration: 1.6, tagline: 'India ka No.1 Billing App' };
const BRAND_KEYS = ['endCard'];
const END_CARD_KEYS = ['duration', 'tagline'];

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem'];

const VIDEO_NAME = /^[A-Za-z0-9_-]+$/;

const MIN_SHOT_SECONDS = 0.5;  // below this nothing is legible at all
/* Length is an editorial call, not a technical one - rendering a 25s clip
 * costs the same as a 10s one. This is a far outer bound: a whole creator
 * script runs about 60s and the UI section is a slice of that, so anything
 * past 45s means something is wrong rather than long. */
const MAX_VIDEO_SECONDS = 45;

/* Pacing. These are the two ways a clip loses the viewer: a beat too quick to
 * read, or a stretch where nothing happens and they scroll on. */
const MIN_READABLE_SECONDS = 1.0;
const MAX_DEAD_AIR_SECONDS = 2.0;
const MIN_ACTION_GAP_SECONDS = 0.6;

export function parse(text, catalogue) {
  const errors = [];
  const warnings = [];

  let doc;
  try {
    doc = yaml.load(text);
  } catch (e) {
    return { errors: ['YAML could not be read: ' + e.message], warnings };
  }

  if (!doc || typeof doc !== 'object') {
    return { errors: ['The recipe is empty or is not a YAML mapping.'], warnings };
  }

  const screenNames = Object.keys(catalogue);

  const recipe = {
    video: doc.video ?? 'untitled',
    invoice: { ...DEFAULT_INVOICE },
    business: { name: '', ...(doc.business || {}) },
    party: { name: '', ...(doc.party || {}) },
    items: Array.isArray(doc.items) ? doc.items : [],
    brand: { endCard: null },
    shots: []
  };

  /* "video" becomes a directory name under out/, so it must not be able to
   * escape it or be anything but plain text. */
  if (typeof recipe.video !== 'string' || !VIDEO_NAME.test(recipe.video)) {
    errors.push(
      `"video" must be a name of letters, digits, "-" and "_" only, got ${JSON.stringify(recipe.video)}.`
    );
  }

  if (doc.invoice != null) {
    const inv = doc.invoice;
    if (typeof inv !== 'object' || Array.isArray(inv)) {
      errors.push('"invoice" must be a mapping with "number" and "date".');
    } else {
      if (inv.number != null) {
        if (typeof inv.number === 'number' && Number.isInteger(inv.number) && inv.number > 0) {
          recipe.invoice.number = inv.number;
        } else {
          errors.push(`invoice.number must be a positive whole number, got ${JSON.stringify(inv.number)}.`);
        }
      }
      if (inv.date != null) {
        if (typeof inv.date === 'string' && inv.date.trim() !== '') {
          recipe.invoice.date = inv.date;
        } else {
          errors.push(`invoice.date must be text such as "08/10/2026", got ${JSON.stringify(inv.date)}.`);
        }
      }
    }
  }

  if (doc.brand != null) {
    const brand = doc.brand;
    if (typeof brand !== 'object' || Array.isArray(brand)) {
      errors.push('"brand" must be a mapping, such as "endCard".');
    } else {
      for (const key of Object.keys(brand)) {
        if (!BRAND_KEYS.includes(key)) {
          warnings.push(`brand.${key} is not a known setting and is ignored. Known: ${BRAND_KEYS.join(', ')}.`);
        }
      }
      if (Object.hasOwn(brand, 'endCard')) {
        const card = brand.endCard ?? {};   // "endCard:" with nothing under it means all defaults
        if (typeof card !== 'object' || Array.isArray(card)) {
          errors.push('brand.endCard must be a mapping with "duration" and "tagline".');
        } else {
          for (const key of Object.keys(card)) {
            if (!END_CARD_KEYS.includes(key)) {
              warnings.push(`brand.endCard.${key} is not a known setting and is ignored.`);
            }
          }
          const endCard = { ...DEFAULT_END_CARD };
          if (card.duration != null) {
            if (typeof card.duration === 'number' && Number.isFinite(card.duration) && card.duration > 0) {
              endCard.duration = card.duration;
            } else {
              errors.push(`brand.endCard.duration must be a positive number, got ${JSON.stringify(card.duration)}.`);
            }
          }
          if (card.tagline != null) {
            if (typeof card.tagline === 'string' && card.tagline.trim() !== '') {
              endCard.tagline = card.tagline;
            } else {
              errors.push(`brand.endCard.tagline must be text, got ${JSON.stringify(card.tagline)}.`);
            }
          }
          recipe.brand.endCard = endCard;
        }
      }
    }
  }

  /* Present but not a list is an error, for the same reason a malformed
   * "actions" is: silently emptying it makes every later addItem complain the
   * recipe lists 0 items, which points the author at the wrong line. An absent
   * items key stays valid - a shot can be about a screen with no bill on it. */
  if (doc.items != null && !Array.isArray(doc.items)) {
    errors.push(`"items" must be a list, got ${typeof doc.items}.`);
  }

  if (!Array.isArray(doc.shots) || doc.shots.length === 0) {
    errors.push('The recipe needs a "shots" list with at least one shot.');
    return { errors, warnings };
  }

  let totalSeconds = 0;

  doc.shots.forEach((shot, i) => {
    const where = `shot ${i + 1}`;

    if (!shot || typeof shot !== 'object') {
      errors.push(`${where} is not a mapping.`);
      return;
    }

    if (!Object.hasOwn(catalogue, shot.screen)) {
      errors.push(
        `${where}: unknown screen "${shot.screen}". Valid screens: ${screenNames.join(', ')}.`
      );
      return;
    }

    const duration = shot.duration;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      errors.push(`${where}: duration must be a positive number, got ${JSON.stringify(shot.duration)}.`);
      return;
    }
    if (duration < MIN_SHOT_SECONDS) {
      warnings.push(`${where}: ${duration}s is very short - under ${MIN_SHOT_SECONDS}s is hard to read.`);
    }
    totalSeconds += duration;

    const targets = catalogue[shot.screen];
    if (shot.actions != null && !Array.isArray(shot.actions)) {
      errors.push(`${where}: "actions" must be a list, got ${typeof shot.actions === 'string' ? '"' + shot.actions + '"' : 'a ' + typeof shot.actions}.`);
      return;
    }
    const actions = shot.actions ?? [];

    actions.forEach((action, j) => {
      const at = `${where}, action ${j + 1}`;

      if (!action || typeof action !== 'object') {
        errors.push(`${at} is not a mapping.`);
        return;
      }
      if (!ACTIONS.includes(action.do)) {
        errors.push(`${at}: unknown action "${action.do}". Valid actions: ${ACTIONS.join(', ')}.`);
        return;
      }

      const when = action.at;
      if (typeof when !== 'number' || !Number.isFinite(when) || when < 0) {
        errors.push(`${at}: "at" must be a number, zero or more, got ${JSON.stringify(action.at)}.`);
        return;
      }
      if (when >= duration) {
        errors.push(`${at}: starts at ${when}s but ${where} is only ${duration}s long.`);
        return;
      }

      if ((action.do === 'tap' || action.do === 'type') && !targets.includes(action.target)) {
        errors.push(
          `${at}: "${action.target}" is not on the ${shot.screen} screen. ` +
          `Valid targets: ${targets.join(', ')}.`
        );
        return;
      }

      if (action.do === 'type' && typeof action.text !== 'string') {
        errors.push(`${at}: a "type" action needs "text".`);
        return;
      }

      if (action.do === 'addItem') {
        const index = Number(action.index);
        if (!Number.isInteger(index) || index < 0) {
          errors.push(`${at}: "index" must be a whole number, got "${action.index}".`);
          return;
        }
        if (index >= recipe.items.length) {
          errors.push(
            `${at}: addItem index ${index} has no matching item ` +
            `(the recipe lists ${recipe.items.length}).`
          );
          return;
        }
      }
    });

    /* Pacing. A shot loses the viewer in one of two ways, and neither stops it
     * rendering - they are judgement calls the author may have made on purpose. */
    const lastAt = actions.length > 0
      ? Math.max(...actions.map(a => Number(a.at)).filter(Number.isFinite))
      : null;

    if (lastAt !== null) {
      const deadAir = duration - lastAt;
      /* A trailing hold on the final shot is good pacing - it lets the result
       * land. Mid-clip it is just a stretch where nothing happens. */
      const isFinalShot = i === doc.shots.length - 1;
      if (!isFinalShot && deadAir > MAX_DEAD_AIR_SECONDS) {
        warnings.push(
          `${where}: nothing happens for the last ${deadAir.toFixed(1)}s. ` +
          `Trim the shot or move the next beat earlier.`
        );
      }

      const times = actions.map(a => Number(a.at)).filter(Number.isFinite).sort((a, b) => a - b);
      for (let k = 1; k < times.length; k++) {
        if (times[k] - times[k - 1] < MIN_ACTION_GAP_SECONDS) {
          warnings.push(
            `${where}: two actions ${(times[k] - times[k - 1]).toFixed(2)}s apart ` +
            `at ${times[k - 1]}s - under ${MIN_ACTION_GAP_SECONDS}s is too quick to follow.`
          );
          break;
        }
      }
    } else if (duration < MIN_READABLE_SECONDS) {
      warnings.push(
        `${where}: ${duration}s with nothing happening is too brief to register.`
      );
    }

    recipe.shots.push({ screen: shot.screen, duration, actions });
  });

  /* The end card is part of the clip the viewer sees, so it counts toward the
   * limit. Measuring only the shots under-reports every branded video. */
  const endCardSeconds = recipe.brand.endCard ? recipe.brand.endCard.duration : 0;
  const clipSeconds = totalSeconds + endCardSeconds;

  if (clipSeconds > MAX_VIDEO_SECONDS) {
    const madeOf = endCardSeconds > 0
      ? ` (${totalSeconds.toFixed(1)}s of shots plus a ${endCardSeconds}s end card)`
      : "";
    warnings.push(
      `The whole clip is ${clipSeconds.toFixed(1)}s${madeOf}. Past ${MAX_VIDEO_SECONDS}s something is probably wrong - a creator script runs about 60s in total.`
    );
  }

  if (errors.length > 0) return { errors, warnings };
  return { recipe, warnings };
}
