import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as yaml from 'js-yaml';
import { RecipeSchema, SCREENS, ACTIONS, THEMES } from '@/lib/schema';

export const maxDuration = 300;

const client = new Anthropic();

const SYSTEM = `You turn a creator ad script for the myBillBook app into a complete shot list for a video renderer.

THE SCRIPT IS THE SOURCE OF TRUTH. Read everything out of it that you can, and only invent what it genuinely does not say:

- The firm or shop name. If the script names the business, use that name exactly.
- The customer or party the bill is made out to, if the script names one.
- The items being billed - their names, prices, quantities and units. Take them from the script wherever it mentions goods. Where it does not, invent items that suit the business the script describes: a kirana shop sells SUGAR 5KG and TATA SALT 1KG, a hardware dealer sells cement and fittings, a pharma distributor sells medicines. Never put grocery items on a hardware bill.
- GST slabs that suit those goods - 5 for staples, 12 or 18 for most manufactured goods.
- The theme. If the script is tied to a festival or occasion - Diwali, Rakhi, Independence Day, Ganesh Chaturthi - set invoice.theme to the matching theme from the list below. If it mentions no occasion, use "none". Never guess a theme that is not on the list.

Available themes: ${THEMES.join(', ')}.

The renderer can show exactly these screens, with exactly these tap targets:
${Object.entries(SCREENS).map(([s, t]) => `- ${s}: ${t.join(', ')}`).join('\n')}

The actions available are: ${ACTIONS.join(', ')}.
- tap needs a target that exists on that shot's screen
- type needs a target and the text to type
- selectParty makes the chosen party appear on the bill
- addItem needs the index of an item in the items list, counting from 0

Rules you must follow:
- Scripts mark their UI moments as [Internal team adds: UI — <screen>]. Use those markers to decide the order of shots.
- Every action's "at" is seconds from the START OF ITS OWN SHOT, and must be less than that shot's duration.
- An addItem index must refer to an item that exists in the items list.
- PACING IS THE THING TO GET RIGHT. These are creator ads: fast enough that nobody is bored, slow enough that nobody is lost. There is no hard length limit - make the clip as long as its beats need and no longer.
- A beat needs about 1.5 to 2.5 seconds to register. Under 1 second nobody reads it.
- Leave no dead air: a shot should end shortly after its last action, not linger. The exception is the final shot, where a short hold lets the result land.
- Keep actions at least 0.6s apart, and nearer 1s when each one changes something the viewer needs to notice.
- Most clips land between 8 and 20 seconds. If the script has far more beats than that, cover the ones that matter rather than rushing all of them.
- Item prices are TAX-INCLUSIVE and gst is the slab percentage, usually 5, 12 or 18.
- "video" must be a short name of letters, digits, hyphens and underscores only.
- Details supplied alongside the script are OVERRIDES. Where one is given it wins over what the script says; where it is blank, take the value from the script.
- If the script describes something the renderer has no screen for, cover what you can with the screens above and keep the video short rather than inventing a screen.`;

export async function POST(req: Request) {
  const { script, details } = await req.json();

  if (!script || typeof script !== 'string') {
    return Response.json({ error: 'A script is required.' }, { status: 400 });
  }

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Overrides (may be empty - anything absent comes from the script):\n${JSON.stringify(details, null, 2)}\n\nScript:\n${script}`
        }
      ],
      output_config: {
        /* Thinking is always on with this model and defaults to medium
         * effort. This task is structured extraction against a fixed schema
         * with a detailed prompt - not hard reasoning - so low effort cuts
         * the thinking tokens, which are most of what a call costs here.
         * Raise it if the shot lists come back sloppy. */
        effort: "low",
        format: zodOutputFormat(RecipeSchema)
      }
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: 'The model did not return a usable shot list. Try again.' },
        { status: 502 }
      );
    }

    return Response.json({ recipe: yaml.dump(response.parsed_output) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 502 });
  }
}
