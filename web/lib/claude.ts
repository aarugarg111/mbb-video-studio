import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as yaml from 'js-yaml';
import type { Recipe } from './schema';
import { TEAM_MODE, proxyBaseUrl } from './team';
import { RecipeSchema, SCREENS, ACTIONS, THEMES } from './schema';
import { explain } from './errors';

/* The prompt is carried over verbatim from the server route. It has been
 * corrected several times against real scripts; rewriting it loses that. */
export const SYSTEM = `You turn a creator ad script for the myBillBook app into a complete shot list for a video renderer.

THE SCRIPT IS THE SOURCE OF TRUTH. Read everything out of it that you can, and only invent what it genuinely does not say:

- The firm or shop name. If the script names the business, use that name exactly.
- The customer or party the bill is made out to, if the script names one.
- The items being billed - their names, prices, quantities and units. Take them from the script wherever it mentions goods. Where it does not, invent items that suit the business the script describes: a kirana shop sells SUGAR 5KG and TATA SALT 1KG, a hardware dealer sells cement and fittings, a pharma distributor sells medicines. Never put grocery items on a hardware bill.
- GST slabs that suit those goods - 5 for staples, 12 or 18 for most manufactured goods.
- The theme. If the script is tied to a festival or occasion - Diwali, Rakhi, Independence Day, Ganesh Chaturthi - set invoice.theme to the matching theme from the list below. If it mentions no occasion, use "none". Never guess a theme that is not on the list. Match by festival: Diwali -> diwali, Rakhi or Raksha Bandhan -> rakhi, Ganesh Chaturthi -> ganesh-chaturthi, Independence Day -> independence, Gandhi Jayanti -> gandhi-jayanti, Dussehra -> dussehra, and so on.

Available themes: ${THEMES.join(', ')}.
- The end card. Set brand.endCard when the script ends on a call to action or a brand line - 1.5 seconds and a short tagline. Set brand.endCard to null when the script just ends on the result.

The renderer can show exactly these screens, with exactly these tap targets:
${Object.entries(SCREENS).map(([s, t]) => `- ${s}: ${t.join(', ')}`).join('\n')}

The actions available are: ${ACTIONS.join(', ')}.
- tap needs a target that exists on that shot's screen
- type needs a target and the text to type
- When the script mentions sharing or sending the invoice on WhatsApp, run the shots invoice-created (tap share), share-sheet (tap contact-0, then send), wa-attach (optionally type a caption into caption, then tap send) and wa-chat. The contact is the bill's party.
- ONCE THE INVOICE IS DELIVERED IN wa-chat, THE CLIP ENDS THERE. Never cut back to a myBillBook screen after a WhatsApp shot - the delivered invoice is the payoff, and returning to the app undoes it. If the script has later beats about the app, place those BEFORE the sharing sequence.
- When the script shows the festive theme being CHOSEN (browsing or picking a theme for the invoice), run the shot invoice-created, then a theme-store shot in which you tap the theme's card (theme-0 to theme-5 are the first six: navaratri, durga-puja, dussehra, dhanteras, diwali, chhath-puja) and then tap close, then a final invoice-created shot that shows the themed bill. Leave invoice.theme as "none" in that case so the choice is visible. A theme with no card among the first six cannot be tapped, so for those just set invoice.theme and skip the theme-store shot.
- When the script is about who owes money - outstanding balances, a ledger, chasing payment, sending a reminder - use the parties screen. It lists the recipe's own party first, so tapping party-row-0 is tapping the customer the script is about, and send-reminder-0 is the WhatsApp reminder beside them.
- When the script is about stock running out - low stock, "maal khatam", knowing what to reorder - use the items screen and tap low-stock. The list then shows only the items at or below their own low level, with the quantity in red. Give those items a small stock in the items list, or the filter empties the screen.
- When the script is about scanning or photographing a bill instead of typing it - Scan & Record, "bill ki photo", reading a supplier's invoice - run the shots scan-bills (tap open-camera), scan-camera (tap shutter), scan-reading, scan-done and create-purchase (tap create-purchase). scan-reading and scan-done take no actions; they are the app working and they pass on their own, so give them about 2 seconds each. The camera films the recipe's own items, so put the supplier's goods in items.
- myCashFlo is a DIFFERENT PRODUCT from myBillBook - it chases payments rather than making bills - and its screens are the four named mcf-*. Use them when the script is about money not coming back: udhaar, recovery, "paisa phansa hua hai", customers who do not pay, chasing by phone all day, reminders going out on their own. Run mcf-dashboard (tap call-personally) to show what is outstanding and how much is already late, mcf-parties (tap party-row-0) for who owes it, mcf-party (tap pause-calls) for one customer and the moment the owner stops chasing by hand, and mcf-automations (tap new-automation) for the chasing the app does instead. The recipe's own party leads the list, so party-row-0 is the customer the script is about. Give that party a balance and an overdueDays, and the figures across all four screens follow from them.
- tally-receivables is Tally's own Bills Receivable report, for the beat where the owner says Tally tells him what is pending but somebody still has to chase it. Use it ONLY as a short cutaway before the myCashFlo shots, never as the clip's destination - the point of these scripts is what happens after Tally. It reads the same parties as the myCashFlo screens, so the two agree on screen. It pairs with mcf-tally, which is the sync arriving.
- When a myCashFlo script mentions Tally - "Tally se sync", outstanding coming across from Tally - use the mcf-tally shot. It shows the sync running and the outstanding landing. Do NOT try to show Tally itself: Tally is somebody else's software and there is no screen for it, so a shot of the owner looking at Tally on a laptop is footage the creator films. Put that in "unsupported" only if the script insists on seeing Tally's own interface.
- When the script has the AI ringing a customer - "AI follow-up karta hai", an AI voice asking when payment will clear - use the mcf-ai-call shot. It plays the exchange as a transcript that writes itself across the shot and ends on the commitment being noted, so give it at least 9 seconds or the last line never lands. It takes no actions.
- tally-receivables may sit alongside the myCashFlo screens, because the script is about Tally handing over to myCashFlo. It must NEVER appear in a myBillBook clip.
- NEVER MIX myBillBook AND myCashFlo SCREENS IN ONE CLIP. They are two apps with two different looks, and cutting between them reads as footage of the wrong product. A script about billing uses the myBillBook screens; a script about recovering money uses the mcf-* ones.
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
- If the script describes something the renderer has no screen for, cover what you can with the screens above and keep the video short rather than inventing a screen.
- Put in "unsupported" every feature the script asks for that none of the available screens can show. Name the feature as the script describes it, briefly: "batch-wise stock records", "GST reports". Use an empty array when the screens cover the whole script.
- Still build the best shot list you can from the screens that do exist. The "unsupported" list is a warning to the author, not a refusal.`;

/* Split the model's output into the recipe YAML and the unsupported list.
 * src/recipe.js knows nothing about "unsupported", so it must never reach the
 * YAML. */
export function splitRecipe(parsed: Recipe): { recipe: string; unsupported: string[] } {
  const { unsupported, ...rest } = parsed;
  return { recipe: yaml.dump(rest), unsupported: unsupported ?? [] };
}

export async function proposeRecipe(
  { apiKey, script, details }: { apiKey?: string; script: string; details: unknown }
): Promise<{ recipe: string; unsupported: string[] }> {
  /* Two ways to reach Anthropic, and the request below is identical either
   * way. In team mode the studio posts to its own Worker, which holds the key
   * and checks the session cookie; the placeholder below is never read by
   * anything, but the SDK refuses to start without some key. Otherwise the
   * key is the viewer's own, held in their browser and sent only to Anthropic. */
  const client = TEAM_MODE
    ? new Anthropic({ apiKey: 'held-by-the-worker', baseURL: proxyBaseUrl(), dangerouslyAllowBrowser: true })
    : new Anthropic({ apiKey: apiKey ?? '', dangerouslyAllowBrowser: true });

  /* Whatever comes back from here reaches a teammate's screen, so it is
   * translated on the way out. The raw text is kept on the error so whoever
   * has to fix it still has it. */
  let response;
  try {
    response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Overrides (may be empty - anything absent comes from the script):\n` +
          `${JSON.stringify(details, null, 2)}\n\nScript:\n${script}`
      }],
      output_config: {
        /* Low effort: structured extraction against a fixed schema, not hard
         * reasoning. Raise it if the shot lists come back sloppy. */
        effort: 'low',
        format: zodOutputFormat(RecipeSchema)
      }
    });
  } catch (err) {
    const { message, detail } = explain(err, TEAM_MODE);
    const friendly = new Error(message);
    (friendly as Error & { detail?: string }).detail = detail;
    throw friendly;
  }

  if (!response.parsed_output) {
    throw new Error('The model did not return a usable shot list. Try again.');
  }

  return splitRecipe(response.parsed_output);
}
