/* Parses and validates a recipe before anything slow happens.
 *
 * Errors make rendering impossible and stop the run. Warnings are things the
 * author may have meant, so they render anyway. Both name the shot by index,
 * because that is how a person finds the line in the file.
 */

import { THEME_SLUGS } from './themes.js';
import yaml from 'js-yaml';
import { defaultInvoice } from './invoice.js';
import { TRADES } from './shelves.js';
import { ASPECTS, DEFAULT_ASPECT, aspectNamed } from './aspect.js';
import { deviceOf } from './device.js';
import { foldLaptopShare, joinRepeats } from './shape.js';
import { SCREENS } from '../screens/index.js';
import { itemsFor, lowStockItems } from '../screens/items.js';

export const DEFAULT_END_CARD = { duration: 1.6, tagline: 'India ka No.1 Billing App' };
export const DEFAULT_CTA = { duration: 1.8 };
export const CTA_IMAGE_PATH = 'kit/cta/download-now.png';
const BRAND_KEYS = ['endCard', 'cta'];
const CTA_KEYS = ['duration'];
const END_CARD_KEYS = ['duration', 'tagline'];

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem', 'zoom', 'zoomOut', 'scroll'];

/* How close a zoom may push. Past about four the screen is a few words wide
 * and the viewer loses where they are; below 1.2 nothing appears to happen. */
export const ZOOM_RANGE = { min: 1.2, max: 4 };
export const DEFAULT_ZOOM = 2;

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

/* Themes the recipe may name. 'none', 'warm' and the sixteen festive slugs are built in; the CLI adds the
 * PNG names it finds in kit/themes. Kept as a parameter so this file stays
 * free of filesystem access. */
export const BUILT_IN_THEMES = ['none', 'warm', ...THEME_SLUGS];

export function parse(text, catalogue, options = {}) {
  /* Where a camera may be sent, which is more than what a finger may press: a
   * bill has nothing to press and plenty worth a close-up. Unspecified, a
   * zoom may only go to a tap target, which is how this behaved before any
   * screen named a place. */
  const zoomable = options.zoomable ?? catalogue;
  const themes = options.themes ?? BUILT_IN_THEMES;
  /* How long particular screens need to be on camera for what they show to
   * land - an animation rather than a still. Empty when the caller says
   * nothing, which is how this behaved before any screen declared one. */
  const needs = options.needs ?? {};
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
  /* Which screens have a list worth scrolling. The caller knows; this file
   * sees only screen names and their targets. Unspecified, nothing scrolls,
   * which refuses the action rather than letting it play as a dead shot. */
  const scrollable = options.scrollable ?? [];

  const recipe = {
    video: doc.video ?? 'untitled',
    /* What shape the finished video is: a Reel, a square feed post or a
     * widescreen one. Left out it is vertical, which is what every clip was
     * before there was a choice, so no recipe written before this changes. */
    aspect: DEFAULT_ASPECT,
    invoice: { ...defaultInvoice() },
    business: { name: '', ...(doc.business || {}) },
    party: { name: '', ...(doc.party || {}) },
    items: Array.isArray(doc.items) ? doc.items : [],
    /* The collections book, for myCashFlo clips. A script that says a figure
     * out loud - "market mein mera 52 lakh atka hai" - needs the screens to
     * show that figure, so a recipe may name the parties itself instead of
     * taking the invented ones. Anything not named here is filled in. */
    cashflo: { ...(doc.cashflo || {}) },
    /* The myBillBook dashboard's tiles. Same reason as cashflo: a script that
     * names a figure - "mera 4 lakh collect karna hai" - needs the tile to show
     * that figure. Left out, each tile is worked out from the rest of the
     * recipe rather than from the number the reference recording happened to
     * have, so the dashboard moves with the script either way. */
    dashboard: { ...(doc.dashboard || {}) },
    /* The day's takings and what was left of them. Same reason as the
     * dashboard tiles: a script that says a figure out loud has to be able to
     * put it somewhere, or the screen shows its own arithmetic and the video
     * argues with its own voiceover. */
    sales: { ...(doc.sales || {}) },
    brand: { endCard: null, cta: { ...DEFAULT_CTA, image: true, tagline: DEFAULT_END_CARD.tagline } },
    shots: []
  };

  /* "video" becomes a directory name under out/, so it must not be able to
   * escape it or be anything but plain text. */
  if (typeof recipe.video !== 'string' || !VIDEO_NAME.test(recipe.video)) {
    errors.push(
      `"video" must be a name of letters, digits, "-" and "_" only, got ${JSON.stringify(recipe.video)}.`
    );
  }

  /* The shape of the picture. A misspelling must not pass: it would render
   * a whole clip in the wrong shape, which looks like a finished video and
   * is only wrong where it gets posted. */
  if (doc.aspect != null) {
    const named = aspectNamed(doc.aspect);
    if (named) {
      recipe.aspect = named;
    } else {
      errors.push(
        `aspect must be one of ${Object.keys(ASPECTS).join(', ')} `
        + `(or vertical, square, horizontal), got ${JSON.stringify(doc.aspect)}.`
      );
    }
  }

  /* What the shop sells, which decides the rest of its shelf. A typo here
   * used to pass straight through and quietly restock a cosmetics shop with
   * dal, so it is checked and the choices are named. */
  if (doc.business?.trade != null) {
    const trade = String(doc.business.trade).trim().toLowerCase();
    if (TRADES.includes(trade)) {
      recipe.business.trade = trade;
    } else {
      errors.push(
        `business.trade must be one of ${TRADES.join(', ')}, got ${JSON.stringify(doc.business.trade)}.`
      );
    }
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
      if (inv.theme != null) {
        if (typeof inv.theme === 'string' && themes.includes(inv.theme)) {
          recipe.invoice.theme = inv.theme;
        } else {
          /* A video that renders unthemed beats one that does not render. */
          warnings.push(
            `invoice.theme ${JSON.stringify(inv.theme)} is not a known theme, so the bill renders plain. ` +
            `Known: ${themes.join(', ')}.`
          );
          recipe.invoice.theme = 'none';
        }
      }
      /* Which bill template. "luxury" is the decorated one and the default,
       * because it is what the ads are meant to show; "plain" is the
       * undecorated bill this studio started with. */
      if (inv.skin != null) {
        if (inv.skin === 'luxury' || inv.skin === 'plain') {
          recipe.invoice.skin = inv.skin;
        } else {
          warnings.push(
            `invoice.skin ${JSON.stringify(inv.skin)} is not a bill template, so the Luxury one is used. ` +
            'Known: luxury, plain.'
          );
        }
      }
      /* How strongly the festival art shows through, 0 to 1. Left out, each
       * festival uses the strength chosen for it. A clip whose art fights the
       * figures can turn it down without changing every other clip. */
      if (inv.themeStrength != null) {
        const n = Number(inv.themeStrength);
        if (Number.isFinite(n) && n >= 0 && n <= 1) {
          recipe.invoice.themeStrength = n;
        } else {
          errors.push(
            `invoice.themeStrength must be a number between 0 and 1, got ${JSON.stringify(inv.themeStrength)}.`
          );
        }
      }
    }
  }

  /* options.ctaImage: whether kit/cta/download-now.png exists. This file does
   * no filesystem access, so the caller says. Left unspecified it is assumed
   * present. */
  const ctaImage = options.ctaImage !== false;

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
        /* What "endCard: null" means.
         *
         * The briefing and the output schema both tell the model to write
         * null when the clip should NOT close on a branded line, and this
         * read null as "all defaults" - so the one value the AI path writes
         * most got the default card back, plus a warning blaming the recipe
         * for setting both cta and endCard when it had deliberately set
         * neither. An empty mapping still means defaults, which is how a
         * recipe asks for one. */
        const written = brand.endCard;
        const card =
          written == null || written === false ? null
          : written === true ? {}
          /* A tagline, or a number of seconds, written on its own. There is
           * exactly one text field and one numeric one, so neither reading
           * is ambiguous - and both are what somebody writes before they go
           * and look the shape up. Refusing them cost a whole recipe. */
          : typeof written === 'string' ? { tagline: written }
          : typeof written === 'number' ? { duration: written }
          : written;

        if (card === null) {
          recipe.brand.endCard = null;
        } else if (typeof card !== 'object' || Array.isArray(card)) {
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
      if (Object.hasOwn(brand, 'cta')) {
        const cta = brand.cta ?? {};   // "cta:" with nothing under it means all defaults
        if (cta === false) {
          recipe.brand.cta = null;
        } else if (cta === true) {
          // the default, spelled out
        } else if (typeof cta !== 'object' || Array.isArray(cta)) {
          errors.push('brand.cta must be a mapping with "duration", or false to turn it off.');
        } else {
          for (const key of Object.keys(cta)) {
            if (!CTA_KEYS.includes(key)) {
              warnings.push(`brand.cta.${key} is not a known setting and is ignored.`);
            }
          }
          if (cta.duration != null) {
            if (typeof cta.duration === 'number' && Number.isFinite(cta.duration) && cta.duration > 0) {
              recipe.brand.cta.duration = cta.duration;
            } else {
              errors.push(`brand.cta.duration must be a positive number, got ${JSON.stringify(cta.duration)}.`);
            }
          }
        }
      }
      if (recipe.brand.cta && recipe.brand.endCard) {
        warnings.push('brand sets both cta and endCard. The CTA closes the clip; the endCard is used only for the tagline when the CTA image is missing.');
        recipe.brand.cta.tagline = recipe.brand.endCard.tagline;
      }
    }
  }

  /* Present but not a list is an error, for the same reason a malformed
   * "actions" is: silently emptying it makes every later addItem complain the
   * recipe lists 0 items, which points the author at the wrong line. An absent
   * items key stays valid - a shot can be about a screen with no bill on it. */
  if (doc.cashflo?.parties != null) {
    if (!Array.isArray(doc.cashflo.parties)) {
      errors.push('"cashflo.parties" must be a list of parties.');
    } else {
      doc.cashflo.parties.forEach((p, i) => {
        const at = `cashflo.parties[${i}]`;
        if (!p || typeof p !== 'object') {
          errors.push(`${at} must be a mapping with a name and a balance.`);
          return;
        }
        if (!p.name) errors.push(`${at} needs a name.`);
        if (p.balance != null && !(Number(p.balance) >= 0)) {
          errors.push(`${at}.balance must be a number, got ${JSON.stringify(p.balance)}.`);
        }
      });
    }
  }

  /* The day's sale and the net profit, when a script states them. Both are
   * money, so both are a number or a typo. */
  if (doc.sales != null) {
    if (typeof doc.sales !== 'object' || Array.isArray(doc.sales)) {
      errors.push('"sales" must be a mapping of figures to amounts.');
    } else {
      const figures = ['dayTotal', 'netProfit'];
      for (const [key, value] of Object.entries(doc.sales)) {
        if (!figures.includes(key)) {
          errors.push(`sales.${key} is not a figure. Known: ${figures.join(', ')}.`);
        } else if (value == null) {
          delete recipe.sales[key];
        } else if (!(Number(value) >= 0)) {
          errors.push(`sales.${key} must be an amount, got ${JSON.stringify(value)}.`);
        }
      }
      /* Profit comes out of the takings, so a profit bigger than the sale
       * would need a negative purchase - a report that cannot be true. */
      const day = Number(recipe.sales.dayTotal);
      const net = Number(recipe.sales.netProfit);
      if (Number.isFinite(day) && Number.isFinite(net) && net > day) {
        errors.push(
          `sales.netProfit (${net}) is more than sales.dayTotal (${day}), which would need the shop ` +
          'to have bought its stock for less than nothing.'
        );
      }
    }
  }

  /* Each dashboard figure is money, so it is a number or it is a typo. Naming a
   * tile that does not exist is a typo too, and a silent one: the video would
   * render with the worked-out figure and the author would never learn why. */
  if (doc.dashboard != null) {
    if (typeof doc.dashboard !== 'object' || Array.isArray(doc.dashboard)) {
      errors.push('"dashboard" must be a mapping of tile names to amounts.');
    } else {
      const tiles = ['toCollect', 'toPay', 'weekSale'];
      for (const [key, value] of Object.entries(doc.dashboard)) {
        if (!tiles.includes(key)) {
          errors.push(`dashboard.${key} is not a tile. Known: ${tiles.join(', ')}.`);
        } else if (value == null) {
          /* A shot list written by a model fills every field, and writes null
           * for the ones the script never settled. Null means "work it out",
           * so the tile is dropped rather than rendered as nothing. */
          delete recipe.dashboard[key];
        } else if (!(Number(value) >= 0)) {
          errors.push(`dashboard.${key} must be an amount, got ${JSON.stringify(value)}.`);
        }
      }
    }
  }

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
    /* Some screens are an animation, not a still, and have their own floor.
     * The AI call writes a transcript across the shot; the laptop invoice
     * fills itself in after the tap. Cut short they play as a beat nobody
     * can read, and the clip renders and parses perfectly, so without this
     * nothing ever says so. */
    const needed = needs[shot.screen];
    if (Number.isFinite(needed) && duration < needed) {
      warnings.push(
        `${where}: the ${shot.screen} screen needs about ${needed}s for what it shows to ` +
        `land and this gives it ${duration}s. What it is in the middle of will be cut off.`
      );
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
      /* A zoom names a target the same way a tap does, because it is the same
       * list of measured points - "zoom in on Net Profit" means the point the
       * screen already calls net-profit. */
      if (action.do === 'zoom') {
        const to = action.to ?? DEFAULT_ZOOM;
        if (!(Number(to) >= ZOOM_RANGE.min && Number(to) <= ZOOM_RANGE.max)) {
          errors.push(
            `${at}: zoom "to" must be between ${ZOOM_RANGE.min} and ${ZOOM_RANGE.max}, got ${JSON.stringify(action.to)}.`
          );
        }
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

      /* A zoom is checked against the places as well as the buttons. */
      if (action.do === 'zoom' && !(zoomable[shot.screen] ?? targets).includes(action.target)) {
        const places = zoomable[shot.screen] ?? targets;
        errors.push(
          `${at}: the ${shot.screen} screen has nowhere called "${action.target}" to zoom to. ` +
          `Places: ${places.join(', ')}.`
        );
        return;
      }

      if ((action.do === 'tap' || action.do === 'type') && !targets.includes(action.target)) {
        /* Naming a button that lives on a DIFFERENT screen is the commonest
         * way this goes wrong, and a bare list of valid targets does not help
         * with it: whoever wrote the shot knows what they meant to tap, they
         * just had the wrong screen under it. So say where it actually is. */
        const elsewhere = Object.entries(catalogue)
          .filter(([name, list]) => name !== shot.screen && list.includes(action.target))
          .map(([name]) => name);

        errors.push(
          `${at}: "${action.target}" is not on the ${shot.screen} screen. ` +
          (elsewhere.length ? `It is on ${elsewhere.join(', ')} - cut to one of those to tap it. ` : '') +
          `Valid targets: ${targets.join(', ')}.`
        );
        return;
      }

      /* Scrolling a screen with nothing to scroll would play as a shot where
       * nothing happens, and nothing would report it. A screen says for
       * itself whether it has a list long enough to move. */
      if (action.do === 'scroll' && !scrollable.includes(shot.screen)) {
        errors.push(
          `${at}: the ${shot.screen} screen does not scroll - everything on it is already on screen. ` +
          `Screens that scroll: ${scrollable.join(', ')}.`
        );
        return;
      }

      /* How long a scroll or a typed word takes. Nothing checked it, and the
       * two ways to get it wrong both fail quietly: zero divides and puts a
       * NaN in the transform, which the browser drops - so the list snaps
       * back for exactly one frame - and a negative one never moves at all. */
      if (action.duration != null && !(Number(action.duration) > 0)) {
        errors.push(
          `${at}: duration must be a number of seconds greater than zero, got ${JSON.stringify(action.duration)}.`
        );
        return;
      }

      if (action.do === 'scroll' && action.distance != null && !(Number(action.distance) > 0)) {
        errors.push(`${at}: scroll distance must be a number of pixels greater than zero, got ${JSON.stringify(action.distance)}.`);
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

  /* Sending the invoice is the payoff of a sharing script, so the delivered
   * chat is where the clip should rest. Cutting back into the app afterwards
   * reads as a mistake - which is exactly what it looked like the first time
   * a generated video did it. */
  /* A clip that cuts between a laptop and a phone mid-thought reads as two
   * different videos spliced together. Both render perfectly well, which is
   * why this is worth saying out loud. */
  const shapes = new Set(recipe.shots.map(shot => deviceOf(SCREENS[shot.screen])));

  /* One mix is not a mistake: a bill sent from the laptop and ARRIVING on the
   * customer's phone. There is no WhatsApp Web screen in this studio and there
   * should not be - the chat belongs to the customer, not to the owner's
   * desk - so a laptop clip whose script ends "show the WhatsApp chat with the
   * invoice attached" has to finish on a phone, and that is the right film.
   *
   * Warning about it was doing real harm rather than none. A script asking for
   * exactly that got a studio telling the writer the clip was wrong, and shot
   * lists came back with the WhatsApp screen left out altogether - the payoff
   * of a sharing video, dropped to satisfy a warning. */
  const tail = recipe.shots.map(s => s.screen);
  const whatsappEnding = tail.length > 1 &&
    tail[tail.length - 1].startsWith('wa-') &&
    tail.slice(0, -1).every(name => deviceOf(SCREENS[name]) === 'desktop');

  if (shapes.size > 1 && !whatsappEnding) {
    warnings.push(
      'This clip cuts between a laptop and a phone. Both render, but on video it reads ' +
      'as two different films spliced together. Keep to one, unless the script really ' +
      'does move from a desk to a counter.'
    );
  }

  /* myCashFlo and myBillBook are two different apps with two different looks.
   * A clip that cuts between them reads as footage of the wrong product
   * spliced in by mistake - so this is worth saying out loud, even though
   * both render perfectly well. */
  /* Tally sits on the myCashFlo side: these scripts are about Tally handing
   * over to it, so the two belong in one clip. In a myBillBook clip it is as
   * wrong as myCashFlo would be. */
  const products = new Set(recipe.shots.map(shot =>
    shot.screen.startsWith('mcf-') || shot.screen.startsWith('tally-')
      ? 'myCashFlo'
      : 'myBillBook'));
  if (products.size > 1) {
    warnings.push(
      'This clip mixes myBillBook and myCashFlo screens. They are different apps ' +
      'and look different, so cutting between them reads as the wrong footage. ' +
      'Split it into two clips, or keep to one product.'
    );
  }

  /* There was a warning here about Low Stock emptying the screen on camera.
   *
   * It is gone because the screen cannot empty any more. It used to be able
   * to - the page filtered the fourteen rows it had room for, so a script
   * listing a dozen healthy items of its own left nothing to show - and the
   * studio's answer was to tell the writer to go and edit stock figures by
   * hand until the screen they had already asked for appeared.
   *
   * That is the wrong way round. A script that asks what is running out is
   * asking for a screen, not setting a puzzle. screens/items.js answers it
   * from the shop's whole shelf now, so there is always something to show,
   * and nothing to warn about. test/low-stock.test.js holds that line.
   */

  const lastWhatsApp = recipe.shots.map(s => s.screen).lastIndexOf('wa-chat');
  if (lastWhatsApp !== -1) {
    const after = recipe.shots
      .slice(lastWhatsApp + 1)
      .map(s => s.screen)
      .filter(s => !s.startsWith('wa-') && s !== 'share-sheet');

    if (after.length > 0) {
      warnings.push(
        `The clip returns to ${after.join(', ')} after the invoice is delivered on WhatsApp. ` +
        `Sending it is the payoff, so the clip should end there - move those shots before the sharing sequence.`
      );
    }
  }

  if (recipe.brand.cta) {
    recipe.brand.cta.image = ctaImage;
    if (!ctaImage) {
      warnings.push(
        `The download CTA image is missing, so the clip closes on the plain logo card instead. ` +
        `Expected the file at ${CTA_IMAGE_PATH} - see kit/cta/README.md.`
      );
    }
  }

  /* The end card is part of the clip the viewer sees, so it counts toward the
   * limit. Measuring only the shots under-reports every branded video. */
  const endCardSeconds = recipe.brand.cta ? recipe.brand.cta.duration : (recipe.brand.endCard ? recipe.brand.endCard.duration : 0);
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

  /* A laptop clip that reached for the phone's share sheet is repaired rather
   * than reported. The warning about mixing shapes was already here and it was
   * not enough: it told the writer the clip cut to a phone, while the studio
   * went ahead and rendered a tap on Share followed by a phone screen, with
   * the laptop's own menu never on camera. See src/shape.js. */
  const { recipe: tidied, folded } = foldLaptopShare(recipe);
  /* And two shots of one screen become one shot. A screen's state starts
   * fresh each shot, so a menu opened by a tap at the end of one shot is shut
   * again by the start of the next - which is how "tap Share, then tap
   * WhatsApp", written as two shots, produced a clip whose menu never opened.
   * See src/shape.js. */
  tidied.shots = joinRepeats(tidied.shots);
  if (folded.length > 0) {
    warnings.push(
      `The laptop's share happens on the invoice itself, so ${folded.join(' and ')} ` +
      `${folded.length > 1 ? 'were' : 'was'} folded into it. Tapping Share there opens the menu ` +
      `and WhatsApp is chosen from it - cutting to the phone's share sheet would have hidden ` +
      `the menu the tap just opened.`
    );
  }
  return { recipe: tidied, warnings };
}
