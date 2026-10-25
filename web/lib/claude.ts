import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as yaml from 'js-yaml';
import type { Recipe } from './schema';
import { TEAM_MODE, proxyBaseUrl } from './team';
import { RecipeSchema, SCREENS, ACTIONS, THEMES } from './schema';
import { explain } from './errors';
/* Shared with the command line, so the two cannot disagree about which laptop
   screen stands in for which phone screen. */
import { recastShape } from '../../src/shape.js';
import { catalogue, scrollables } from '../../screens/index.js';

const CATALOGUE = catalogue() as Record<string, string[]>;

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
- zoom pushes the camera in on one thing. When the script says to zoom, or to show a figure close up - "₹14 lakh dikhao", "net profit pe focus karo", "close up on the total" - use { at, do: zoom, target: <the point>, to: 2 }. The target is the SAME name a tap would use, so zoom to net-profit, to-collect, outstanding, total, item-row-0 and so on. "to" is how far, between 1.2 and 4; 2 to 2.5 reads well on a phone. Follow it with { at, do: zoomOut } when the shot should pull back; without one it stays in for the rest of the shot. Leave at least a second after the zoom lands so the viewer can read what it landed on.
- When the script mentions sharing or sending the invoice on WhatsApp, run the shots invoice-created (tap share), share-sheet (tap contact-0, then send), wa-attach (optionally type a caption into caption, then tap send) and wa-chat. The contact is the bill's party.
- ONCE THE INVOICE IS DELIVERED IN wa-chat, THE CLIP ENDS THERE. Never cut back to a myBillBook screen after a WhatsApp shot - the delivered invoice is the payoff, and returning to the app undoes it. If the script has later beats about the app, place those BEFORE the sharing sequence.
- When the script shows the festive theme being CHOSEN (browsing or picking a theme for the invoice), run the shot invoice-created, then a theme-store shot in which you tap the theme's card (theme-0 to theme-5 are the first six: navaratri, durga-puja, dussehra, dhanteras, diwali, chhath-puja) and then tap close, then a final invoice-created shot that shows the themed bill. Leave invoice.theme as "none" in that case so the choice is visible. A theme with no card among the first six cannot be tapped, so for those just set invoice.theme and skip the theme-store shot.
- When the script ends by ADDING UP A DAY - "poore din mein kitna kamaaya", a stall or shop checking its takings - run sales-list then profit-loss. sales-list is every bill made, newest first, with Paid and Unpaid; tapping change-range narrows it to today. profit-loss is the app's own Profit and Loss report, and Net Profit at the bottom is the figure those scripts are built around. Both read the FIRST item in the items list, so put what the shop actually sells there with a rate and a purchase price - the profit is the difference between them.
- When the script is about who owes money - outstanding balances, a ledger, chasing payment, sending a reminder - use the parties screen. It lists the recipe's own party first, so tapping party-row-0 is tapping the customer the script is about, and send-reminder-0 is the WhatsApp reminder beside them.
- When the script is about stock running out - low stock, "maal khatam", knowing what to reorder - use the items screen and tap low-stock. The list then shows only the items at or below their own low level, with the quantity in red. Give those items a small stock in the items list, or the filter empties the screen.
- When the script is about scanning or photographing a bill instead of typing it - Scan & Record, "bill ki photo", reading a supplier's invoice - run the shots scan-bills (tap open-camera), scan-camera (tap shutter), scan-reading, scan-done and create-purchase (tap create-purchase). scan-reading and scan-done take no actions; they are the app working and they pass on their own, so give them about 2 seconds each. The camera films the recipe's own items, so put the supplier's goods in items.
- myCashFlo is a DIFFERENT PRODUCT from myBillBook - it chases payments rather than making bills - and its screens are the four named mcf-*. Use them when the script is about money not coming back: udhaar, recovery, "paisa phansa hua hai", customers who do not pay, chasing by phone all day, reminders going out on their own. Run mcf-dashboard (tap call-personally) to show what is outstanding and how much is already late, mcf-parties (tap party-row-0) for who owes it, mcf-party (tap pause-calls) for one customer and the moment the owner stops chasing by hand, and mcf-automations (tap new-automation) for the chasing the app does instead. The recipe's own party leads the list, so party-row-0 is the customer the script is about. Give that party a balance and an overdueDays, and the figures across all four screens follow from them.
- tally-receivables is Tally's own Bills Receivable report, for the beat where the owner says Tally tells him what is pending but somebody still has to chase it. Use it ONLY as a short cutaway before the myCashFlo shots, never as the clip's destination - the point of these scripts is what happens after Tally. It reads the same parties as the myCashFlo screens, so the two agree on screen. It pairs with mcf-tally, which is the sync arriving.
- When a myCashFlo script mentions Tally - "Tally se sync", outstanding coming across from Tally - use the mcf-tally shot. It shows the sync running and the outstanding landing. Do NOT try to show Tally itself: Tally is somebody else's software and there is no screen for it, so a shot of the owner looking at Tally on a laptop is footage the creator films. Put that in "unsupported" only if the script insists on seeing Tally's own interface.
- When the script is about letting the app do the chasing - setting up the follow-up, "AI follow-up laga do", choosing how customers get chased - use mcf-new-automation. AI Call is already the chosen option, so tapping turn-on is the moment the owner hands the job over. The three shots run in this order when the script covers the whole idea: mcf-new-automation (tap turn-on), mcf-ai-ringing, mcf-ai-call.
- mcf-ai-ringing is the call as the CUSTOMER receives it - their phone ringing, myCashFlo AI on the other end. Use it to show the AI actually reaching somebody; it takes no actions and about 2.5 seconds is enough.
- When the script has the AI ringing a customer - "AI follow-up karta hai", an AI voice asking when payment will clear - use the mcf-ai-call shot. It plays the exchange as a transcript that writes itself across the shot and ends on the commitment being noted, so give it at least 9 seconds or the last line never lands. It takes no actions.
- tally-receivables may sit alongside the myCashFlo screens, because the script is about Tally handing over to myCashFlo. It must NEVER appear in a myBillBook clip.
- myBillBook has LAPTOP screens too, drawn in a browser window: mbb-desktop-parties (everyone you deal with, with To Collect and To Pay across the top), mbb-desktop-items (the catalogue, with Stock Value, Low Stock and Items Expiring - tap low-stock to narrow it) and mbb-desktop-create-invoice. Use them when the script is set at a desk or a counter with a computer, or when the beat is seeing everything at once, which a phone cannot show.
- mbb-desktop-create-invoice is the one to reach for when the script is about NOT typing a bill: the panel down the left is Mira AI, and tapping upload drops a supplier's bill in and fills the form from it. Before the tap the form is empty outlines; after it the party, the lines and the totals are all there. That change is the shot - give it at least 4 seconds so both halves are seen.
- mbb-desktop-invoice is the bill AFTER it is made, on a laptop: the invoice itself, what has been paid down the right, and Record Payment In. Tapping record-payment turns Unpaid into Paid and the balance to zero, which is the beat for a script about getting paid.
- mbb-desktop-purchase is Create Purchase Invoice - a SUPPLIER'S bill going in rather than a customer's coming out. Same Mira AI panel as the sales side. Use it for a wholesaler or distributor script where the bill arrives on paper.
- mcf-desktop is myCashFlo on a LAPTOP, drawn in a browser window instead of a phone. Use it when the script is set at a desk or mentions a computer - "laptop pe dekho", an accountant at a screen - or when the beat is the whole book at once, which a phone cannot show. It carries the Talk to AI Accountant bar, and tapping setup-automation opens the New Call Follow-Up sheet. Do not mix it into a run of phone shots without reason: cutting between a laptop and a phone mid-thought reads as two different videos.
- The overrides may carry "shape". "phone" means use the phone screens throughout, "laptop" means prefer the laptop ones - mbb-desktop-parties, mbb-desktop-items, mbb-desktop-create-invoice, mbb-desktop-invoice, mbb-desktop-purchase, mcf-desktop - wherever a laptop version of the screen exists, and the phone one only where it does not. When "shape" is absent, choose from the script: a counter, a stall or somebody holding a phone is a phone; a desk, an office or a computer is a laptop.
- NEVER MIX A LAPTOP AND A PHONE IN ONE CLIP unless the script really does move from a desk to a counter. Cutting between the two mid-thought reads as two different films spliced together.
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
- WHEN THE SCRIPT SAYS A FIGURE OUT LOUD, PUT IT IN THE RECIPE. "Mera 4 lakh collect karna hai" is dashboard.toCollect: 400000. "Market mein 52 lakh atka hai" is a cashflo.parties list that adds up to 5200000. A figure the voiceover says and the screen does not show makes the video contradict itself. Write null for any dashboard tile the script leaves alone, and an empty cashflo.parties list when it names nobody - the studio works those out from the rest of the recipe.
- A MENTION OF myCASHFLO IS A WHOLE PROCESS, NOT A SCREEN: a clip showing one step of it sells nothing. Cover the arc - the outstanding arriving (mcf-tally, after tally-receivables if Tally is mentioned), the parties (mcf-parties), the automation being SET UP (mcf-new-automation), the call (mcf-ai-ringing then mcf-ai-call), and what keeps running after (mcf-party, mcf-automations). Drop steps only when the script is clearly about one of them.
- SHOW THE OPTIONS THE SCRIPT ASKS FOR - they are what the owner actually worries about. Which language: lang-hindi, lang-english, lang-hinglish. How hard to push: tone-assertive, tone-final, tone-legal. WhatsApp or SMS instead of a call: channel-whatsapp, channel-sms.
- Scan & Record works in BOTH shapes, whole flow either way - bill in, the wait, the entry out. Phone: scan-bills, scan-camera, scan-reading, scan-done. Laptop (a file dropped on the window, or a photo sent from the phone): mbb-desktop-scan, mbb-desktop-scan-reading, mbb-desktop-scan-done.
- Tally is a Windows program: tally-receivables is always a laptop window, even in a phone clip. The owner turns to his computer.
- THE DAY'S SALE AND THE PROFIT GO IN "sales": "aaj 45 hazaar ka sale hua" is sales.dayTotal: 45000, "12 hazaar bacha" is sales.netProfit: 12000. Not the same as dashboard.weekSale, which is the week's figure on the home screen. Null for either the script leaves open. A profit cannot exceed the sale it came out of.
- THE DAY'S TAKINGS ARE NOT ON THE SALES LIST: it has no total, because the real screen has none. A script ending on "aaj ki total kamaai kitni hui" cuts sales-list for the bills, then home or profit-loss for the number.
- "scroll" WORKS ONLY ON: ${scrollables().join(', ')} - the screens whose list runs past the bottom. A bill, a report or a form is already on screen in full, and scrolling one is refused. Use it to show there was more than fitted.
- A ZOOM CAN GO SOMEWHERE THAT IS NOT A BUTTON. A bill has nothing worth pressing and plenty worth a close-up, so on invoice-created, bill-open and mbb-desktop-invoice a zoom may name any of: customer, mobile-number, invoice-number, invoice-date, bill-items, totals, balance. "Uska number dikhao" is { do: zoom, target: mobile-number }. A TAP still has to be a real button.
- OPENING A BILL THAT ALREADY EXISTS is bill-open, not invoice-created. invoice-created is the moment a bill is MADE and says so; bill-open is the same bill looked up afterwards, which is what a script means by "uska purana bill nikalo" or "customer ne poocha kitna baaki hai". Reach it from sales-list by tapping bill-row-0.
- Details supplied alongside the script are OVERRIDES. Where one is given it wins over what the script says; where it is blank, take the value from the script.
- If the script describes something the renderer has no screen for, cover what you can with the screens above and keep the video short rather than inventing a screen.
- Put in "unsupported" every feature the script asks for that none of the available screens can show. Name the feature as the script describes it, briefly: "batch-wise stock records", "GST reports". Use an empty array when the screens cover the whole script.
- Still build the best shot list you can from the screens that do exist. The "unsupported" list is a warning to the author, not a refusal.`;

/* Split the model's output into the recipe YAML and the unsupported list.
 * src/recipe.js knows nothing about "unsupported", so it must never reach the
 * YAML. */
export function splitRecipe(
  parsed: Recipe,
  shape?: string
): { recipe: string; unsupported: string[] } {
  const { unsupported, ...rest } = parsed;
  /* The shape the studio was asked for is applied here rather than left to the
   * prompt. Asking the model is a request; a shot list came back on phone
   * screens whatever the picker said, because the script's own UI markers name
   * phone screens. Swapping them afterwards is the part that cannot be
   * ignored. A tap with no equivalent on the other shape is reported, not
   * quietly dropped. */
  const { recipe, dropped } = recastShape(rest, shape, CATALOGUE);
  const notes = dropped.map(d => `${d} - no equivalent on a ${shape}, so that tap is left out`);
  return { recipe: yaml.dump(recipe), unsupported: [...(unsupported ?? []), ...notes] };
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

  return splitRecipe(response.parsed_output, (details as { shape?: string })?.shape);
}
