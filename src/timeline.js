/* The core of the renderer: given a recipe and a moment in time, what does the
 * screen look like?
 *
 * Pure. No clock, no DOM, no randomness. This is what makes every render of the
 * same recipe byte-identical, and what lets the whole behaviour be tested
 * without producing a single frame.
 */

import { clamp01, easeOut, ramp } from './ease.js';
import { summarise } from './money.js';
import { SCREENS } from '../screens/index.js';

export const TRANSITION_SECONDS = 0.25;

const PARTY_SECONDS = 0.3;
const ITEM_SECONDS = 0.35;
const RIPPLE_SECONDS = 0.6;
const TYPE_SECONDS = 1.2;

export function totalDuration(recipe) {
  return recipe.shots.reduce((sum, shot) => sum + shot.duration, 0);
}

function locate(recipe, t) {
  let elapsed = 0;
  for (let i = 0; i < recipe.shots.length; i++) {
    const shot = recipe.shots[i];
    if (t < elapsed + shot.duration) {
      return { index: i, shot, localT: t - elapsed };
    }
    elapsed += shot.duration;
  }
  const last = recipe.shots.length - 1;
  return { index: last, shot: recipe.shots[last], localT: recipe.shots[last].duration };
}

export function stateAt(recipe, t) {
  const clamped = Math.max(0, t);
  const { index, shot, localT } = locate(recipe, clamped);

  const screenState = {
    party: 0,
    items: recipe.items.map(() => 0),
    total: 0,
    typed: '',
    appear: easeOut(ramp(localT, 0, 0.45))
  };

  let ripple = null;

  for (const action of shot.actions) {
    switch (action.do) {
      case 'selectParty':
        screenState.party = easeOut(ramp(localT, action.at, PARTY_SECONDS));
        break;

      case 'addItem':
        if (action.index < screenState.items.length) {
          screenState.items[action.index] = easeOut(ramp(localT, action.at, ITEM_SECONDS));
        }
        break;

      case 'type': {
        const progress = ramp(localT, action.at, action.duration ?? TYPE_SECONDS);
        const shown = Math.round(progress * action.text.length);
        screenState.typed = action.text.slice(0, shown);
        break;
      }

      case 'tap': {
        const progress = (localT - action.at) / RIPPLE_SECONDS;
        if (progress >= 0 && progress <= 1) {
          const point = SCREENS[shot.screen].targets[action.target];
          ripple = { x: point.x, y: point.y, progress: clamp01(progress) };
        }
        break;
      }

    }
  }

  /* The bill total follows the items' own progress, so it counts up smoothly as
   * each line lands rather than jumping when it appears. Scaling the quantities
   * rather than the money keeps the GST breakdown consistent the whole way. */
  const effective = recipe.items.map((item, i) => ({
    ...item,
    qty: item.qty * screenState.items[i]
  }));
  screenState.total = summarise(effective).total;

  const outgoing = index > 0 && localT < TRANSITION_SECONDS
    ? { screen: recipe.shots[index - 1].screen, progress: localT / TRANSITION_SECONDS }
    : null;

  return { t: clamped, shotIndex: index, screen: shot.screen, outgoing, screenState, ripple };
}
