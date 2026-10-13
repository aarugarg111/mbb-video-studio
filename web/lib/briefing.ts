/* The free path: everything another AI needs, in one block of text.
 *
 * The studio's own Claude call costs a few rupees a video. That is small, but
 * it is also a key to hold and a bill to watch, and some people would rather
 * paste the script into whatever chat tool they already have open. This builds
 * the briefing for that: the same instructions the studio's own call uses, the
 * same list of screens, and the script - ready to paste into ChatGPT, Gemini,
 * Grok or anything else.
 *
 * Nothing here is written out a second time. The instructions come from
 * claude.ts and the shape from schema.ts, because a copy made for this purpose
 * would quietly drift from the one that actually renders - and the symptom
 * would be a shot list that looks right and names a screen that no longer
 * exists.
 */

import { z } from 'zod';
import { SYSTEM } from './claude';
import { RecipeSchema, SCREENS, ACTIONS } from './schema';

export interface Details {
  business?: string;
  party?: string;
  theme?: string;
  /* '' | 'phone' | 'laptop' - which shape the clip is filmed in. */
  shape?: string;
}

/* A chat window has no structured-output mode, so the briefing asks for YAML
 * and shows the shape rather than relying on the API to enforce it. The
 * studio's validator checks the result either way, which is what makes this
 * safe to do with a weaker model. */
function screenTable(): string {
  return Object.entries(SCREENS)
    .map(([screen, targets]) => {
      const list = (targets as readonly string[]);
      return `  ${screen}${list.length ? ` - tap targets: ${list.join(', ')}` : ' - no tap targets'}`;
    })
    .join('\n');
}

export function shapeOfARecipe(): string {
  const schema = z.toJSONSchema(RecipeSchema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  /* "unsupported" is how the studio's own API call reports features the script
   * asked for and no screen can show. It is stripped from the recipe before
   * rendering and means nothing in a YAML shot list - so asking another tool
   * for it would only put a key in the file that the renderer throws away. */
  delete schema.properties?.unsupported;
  schema.required = (schema.required ?? []).filter(key => key !== 'unsupported');
  return JSON.stringify(schema, null, 2);
}

export function briefingFor(script: string, details: Details = {}): string {
  const overrides = [
    details.business ? `business.name: ${details.business}` : null,
    details.party ? `party.name: ${details.party}` : null,
    details.theme ? `invoice.theme: ${details.theme}` : null,
    details.shape === 'laptop'
      ? 'Use the LAPTOP screens (mbb-desktop-*, mcf-desktop) wherever one exists for the screen you want.'
      : details.shape === 'phone'
        ? 'Use the PHONE screens throughout. Do not use any mbb-desktop-* or mcf-desktop screen.'
        : null
  ].filter(Boolean);

  return `${SYSTEM}

SCREENS YOU MAY USE, AND WHAT CAN BE TAPPED ON EACH:

${screenTable()}

Actions: ${ACTIONS.join(', ')}.

ANSWER WITH YAML ONLY. No explanation, no markdown fences, nothing before or
after it. It must match this shape:

${shapeOfARecipe()}

Only "video" and "shots" really matter. Leave out anything the script does
not settle and the studio fills in a sensible default.

The instructions above mention an "unsupported" list. YAML has no place for
it, so instead put any feature the script asks for that no screen can show at
the very top as comment lines, like this, and nowhere else:

# Not shown: GST reports
# Not shown: batch-wise stock records

The YAML the studio expects looks like this:

video: a-short-name-with-hyphens
business:
  name: BALAJI TRADING CO
party:
  name: Rakesh Kumar
items:
  - { name: SUGAR 5KG, rate: 310, qty: 2, gst: 5, unit: PKT }
shots:
  - screen: home
    duration: 2.5
    actions:
      - { at: 1.2, do: tap, target: create-invoice-cta }

${overrides.length ? `USE THESE EXACTLY, WHATEVER THE SCRIPT SAYS:\n${overrides.join('\n')}\n` : ''}
SCRIPT:

${script}`;
}
