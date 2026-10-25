/* The core of the renderer: given a recipe and a moment in time, what does the
 * screen look like?
 *
 * Pure. No clock, no DOM, no randomness. This is what makes every render of the
 * same recipe byte-identical, and what lets the whole behaviour be tested
 * without producing a single frame.
 *
 * Screen state ACCUMULATES across shots: every shot up to and including the
 * current one contributes, earlier ones applied at their full duration. A bill,
 * once built, stays built. Without this the bill emptied itself as it slid off
 * screen during a transition, and the success screen reported a total of zero.
 * The ripple is the exception - it comes from the current shot alone, or one
 * tap would leave a ring on screen for the rest of the video.
 */

import { clamp01, easeOut, ramp } from './ease.js';
import { summarise } from './money.js';
import { SCREENS } from '../screens/index.js';

export const TRANSITION_SECONDS = 0.25;

const SCROLL_SECONDS = 1.2;
/* A little over one card: enough to see the list move and to bring the next
 * ones up, without flinging past what the viewer was reading. */
const SCROLL_DISTANCE = 240;
const PARTY_SECONDS = 0.3;
const ITEM_SECONDS = 0.35;
const RIPPLE_SECONDS = 0.6;
const TYPE_SECONDS = 1.2;
/* Long enough to read as a move, short enough not to eat the shot. */
const ZOOM_SECONDS = 0.55;

const SHEET_DELAY_SECONDS = 0.2;
const SHEET_SECONDS = 0.5;
const SHEET_CLOSE_SECONDS = 0.3;

export const END_CARD_FADE_SECONDS = 0.35;

function shotsDuration(recipe) {
  return recipe.shots.reduce((sum, shot) => sum + shot.duration, 0);
}

/* The card the clip closes on, or null. The download CTA wins over the plain
 * end card; with its artwork missing it is drawn as the logo-and-tagline card
 * ('logo') so a clip still closes. */
export function closing(recipe) {
  const cta = recipe.brand?.cta;
  if (cta) {
    return {
      kind: cta.image === false ? 'logo' : 'cta',
      duration: cta.duration,
      tagline: cta.tagline ?? recipe.brand?.endCard?.tagline ?? ''
    };
  }
  const card = recipe.brand?.endCard;
  return card ? { kind: 'logo', duration: card.duration, tagline: card.tagline } : null;
}

export function totalDuration(recipe) {
  return shotsDuration(recipe) + (closing(recipe)?.duration ?? 0);
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
  /* Past the last shot the locator holds the final shot, so the screen under
   * the end card stays valid and nothing can crash. */
  const { index, shot, localT } = locate(recipe, clamped);

  const card = closing(recipe);
  const cardStart = shotsDuration(recipe);
  const endCard = card && clamped >= cardStart
    ? { progress: clamp01((clamped - cardStart) / END_CARD_FADE_SECONDS), kind: card.kind, tagline: card.tagline }
    : null;

  const screenState = {
    /* How far the screen's own list has been scrolled, in its pixels. */
    scroll: 0,
    party: 0,
    items: recipe.items.map(() => 0),
    total: 0,
    bill: summarise([]),
    typed: '',
    tab: '',
    batching: 0,
    /* Seconds since this shot began. The scanning screens count up on camera
     * and the camera drifts as if hand-held, and deriving both from the clock
     * keeps stateAt a pure function of time - a counter that was stored would
     * make a render depend on how it was reached. */
    t: localT,
    appear: easeOut(ramp(localT, 0, 0.45)),
    /* How far a bottom sheet has slid up. Only the Theme Store reads it. */
    sheet: easeOut(ramp(localT, SHEET_DELAY_SECONDS, SHEET_SECONDS))
  };

  let ripple = null;
  /* Where the camera is pushed in, and how far. Null is the whole screen. */
  let zoom = null;
  /* Every point this shot taps, whether or not the ripple is showing right
   * now. A laptop window is wider than the picture, so part of it is always
   * out of frame, and a tap on the part that is out of frame happens where
   * nobody can see it - which is what became of the button that starts a
   * laptop bill. The camera is given these so it can keep them in shot for
   * the whole shot rather than lurching to each one as it happens. */
  const taps = [];

  /* A bill, once built, stays built: every earlier shot is applied at its full
   * duration (its actions have finished), the current shot at localT. Only the
   * current shot may contribute a ripple or typed text, so a tap or a half-typed
   * field never lingers after the shot that made it. */
  for (let i = 0; i <= index; i++) {
    const s = recipe.shots[i];
    const current = i === index;
    const at = current ? localT : s.duration;

    /* Every scroll in this shot first, before anything asks where a row is.
     * Actions are stored in the order they were written, not the order they
     * happen, so a zoom listed above the scroll that moves its row would
     * otherwise be handed the row's old place. */
    for (const action of s.actions) {
      if (action.do !== 'scroll') continue;
      const over = action.duration ?? SCROLL_SECONDS;
      screenState.scroll += easeOut(ramp(at, action.at, over)) * (action.distance ?? SCROLL_DISTANCE);
    }

    /* Where a target is NOW. A row rides its list, so once the list has moved
     * the row has moved with it, and the camera has to be told the place it
     * is rather than the place it was drawn. Everything else on a screen -
     * a pill, a button, a tab - stays where it is. */
    const pointOf = target => {
      /* Somewhere to look, or something to press. A bill has nothing to press
       * and a great deal worth looking at - the customer's number, a line on
       * it, what is still owed - so a screen may name places as well as
       * buttons, and the camera takes either. */
      const screen = SCREENS[s.screen];
      const point = screen?.targets?.[target] ?? screen?.zoomPoints?.[target];
      if (!point) return point;
      return screen?.scrollingTargets?.includes(target)
        ? { x: point.x, y: point.y - screenState.scroll }
        : point;
    };

    for (const action of s.actions) {
      switch (action.do) {
        case 'selectParty':
          screenState.party = easeOut(ramp(at, action.at, PARTY_SECONDS));
          break;

        case 'addItem':
          if (action.index < screenState.items.length) {
            screenState.items[action.index] = easeOut(ramp(at, action.at, ITEM_SECONDS));
          }
          break;

        /* Scrolling a long list, which until now could not be filmed: a
         * screen showing six of a day's sixty bills had no way to show that
         * there were more. The distance is in the screen's own pixels and
         * eases like everything else, so it reads as a thumb rather than as
         * a jump cut.
         *
         * It survives the shot it happened in - a list scrolled down stays
         * scrolled while the rest of the shot plays out. */
        case 'type': {
          if (!current) break;
          const progress = ramp(at, action.at, action.duration ?? TYPE_SECONDS);
          const shown = Math.round(progress * action.text.length);
          screenState.typed = action.text.slice(0, shown);
          break;
        }

        case 'tap': {
          /* A choice made on an earlier screen (the theme picked in the Theme
           * Store) must still be there on the next one; the rest of a tap's
           * effect, and its ring, belong to the current shot alone. */
          if (!current) {
            const keep = SCREENS[s.screen]?.persists;
            const past = SCREENS[s.screen]?.tapEffects?.[action.target];
            if (keep && past) {
              for (const k of keep) if (k in past) screenState[k] = past[k];
            }
            break;
          }
          const targets = SCREENS[s.screen]?.targets;
          if (!targets || !targets[action.target]) {
            const known = targets ? Object.keys(targets).join(', ') : '(unknown screen)';
            throw new Error(
              `Shot ${i}: screen "${s.screen}" has no tap target "${action.target}". ` +
              `Valid targets: ${known}`
            );
          }
          /* Some taps change the screen: a tab, a toggle. Each screen declares
           * what its own taps do, and the change lands with the ring. */
          const effect = SCREENS[s.screen].tapEffects?.[action.target];
          if (effect && at >= action.at) Object.assign(screenState, effect);
          /* A tap on a sheet's close button slides the sheet back down. */
          if (SCREENS[s.screen].closes?.includes(action.target)) {
            screenState.sheet *= 1 - easeOut(ramp(at, action.at, SHEET_CLOSE_SECONDS));
          }
          /* The camera is told about this tap for the whole shot, not only
           * while its ring is on screen, so the picture holds still. */
          if (current) { const p = pointOf(action.target); taps.push({ x: p.x, y: p.y }); }
          const progress = (at - action.at) / RIPPLE_SECONDS;
          if (progress >= 0 && progress <= 1) {
            const point = pointOf(action.target);
            ripple = { x: point.x, y: point.y, progress: clamp01(progress) };
          }
          break;
        }
        case 'zoom': {
          if (at < action.at) break;
          const targets = SCREENS[s.screen]?.targets;
          const point = pointOf(action.target);
          if (!point) {
            const places = [
              ...Object.keys(SCREENS[s.screen]?.targets ?? {}),
              ...Object.keys(SCREENS[s.screen]?.zoomPoints ?? {})
            ];
            throw new Error(
              `Shot ${i}: screen "${s.screen}" has no point "${action.target}" to zoom to. ` +
              `Valid points: ${places.join(', ') || '(unknown screen)'}`
            );
          }
          /* Eases in rather than cutting, so it reads as a camera move and not
           * as a different shot. */
          /* Two is right for a tile or a figure and too close for a row:
           * a list row is the full width of the screen, so pushing in that
           * far cuts the name off the left of it - which on a shot about
           * what a shop stocks is the one thing that had to stay readable.
           * A row gets a gentler default, and "to" still wins. */
          const isRow = SCREENS[s.screen]?.scrollingTargets?.includes(action.target);
          const to = Number(action.to) || (isRow ? 1.45 : 2);
          const grown = 1 + (to - 1) * easeOut(ramp(at, action.at, ZOOM_SECONDS));
          zoom = { x: point.x, y: point.y, scale: grown };
          break;
        }
        case 'zoomOut': {
          if (at < action.at) break;
          /* Pulls back to whatever it was pushed in from, over the same beat. */
          if (zoom) {
            const back = easeOut(ramp(at, action.at, ZOOM_SECONDS));
            const scale = zoom.scale + (1 - zoom.scale) * back;
            zoom = scale <= 1.001 ? null : { ...zoom, scale };
          }
          break;
        }
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
  screenState.bill = summarise(effective);
  screenState.total = screenState.bill.total;

  const outgoing = index > 0 && localT < TRANSITION_SECONDS
    ? { screen: recipe.shots[index - 1].screen, progress: localT / TRANSITION_SECONDS }
    : null;

  return { t: clamped, shotIndex: index, screen: shot.screen, outgoing, screenState, ripple, zoom, taps, endCard };
}
