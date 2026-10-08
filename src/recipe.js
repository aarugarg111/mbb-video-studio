/* Parses and validates a recipe before anything slow happens.
 *
 * Errors make rendering impossible and stop the run. Warnings are things the
 * author may have meant, so they render anyway. Both name the shot by index,
 * because that is how a person finds the line in the file.
 */

import yaml from 'js-yaml';
import { DEFAULT_INVOICE } from './invoice.js';

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem'];

const VIDEO_NAME = /^[A-Za-z0-9_-]+$/;

const MIN_SHOT_SECONDS = 0.5;
const MAX_VIDEO_SECONDS = 60;

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

    recipe.shots.push({ screen: shot.screen, duration, actions });
  });

  if (totalSeconds > MAX_VIDEO_SECONDS) {
    warnings.push(`The whole video is ${totalSeconds.toFixed(1)}s, over the ${MAX_VIDEO_SECONDS}s guide.`);
  }

  if (errors.length > 0) return { errors, warnings };
  return { recipe, warnings };
}
