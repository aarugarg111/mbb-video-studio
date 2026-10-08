/* Parses and validates a recipe before anything slow happens.
 *
 * Errors make rendering impossible and stop the run. Warnings are things the
 * author may have meant, so they render anyway. Both name the shot by index,
 * because that is how a person finds the line in the file.
 */

import yaml from 'js-yaml';

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem'];

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
    video: doc.video || 'untitled',
    business: { name: '', ...(doc.business || {}) },
    party: { name: '', ...(doc.party || {}) },
    items: Array.isArray(doc.items) ? doc.items : [],
    shots: []
  };

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

    if (!catalogue[shot.screen]) {
      errors.push(
        `${where}: unknown screen "${shot.screen}". Valid screens: ${screenNames.join(', ')}.`
      );
      return;
    }

    const duration = Number(shot.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.push(`${where}: duration must be a positive number, got "${shot.duration}".`);
      return;
    }
    if (duration < MIN_SHOT_SECONDS) {
      warnings.push(`${where}: ${duration}s is very short - under ${MIN_SHOT_SECONDS}s is hard to read.`);
    }
    totalSeconds += duration;

    const targets = catalogue[shot.screen];
    const actions = Array.isArray(shot.actions) ? shot.actions : [];

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

      const when = Number(action.at);
      if (!Number.isFinite(when) || when < 0) {
        errors.push(`${at}: "at" must be zero or more, got "${action.at}".`);
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
          warnings.push(
            `${at}: addItem index ${index} has no matching item ` +
            `(the recipe lists ${recipe.items.length}).`
          );
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
