import { z } from 'zod';

/* Mirrors what src/recipe.js accepts. The model is constrained to this shape,
 * but the renderer's own parser remains the authority - whatever comes back is
 * validated there before anyone sees it.
 *
 * When a screen is added to screens/index.js, add it to SCREENS below - that
 * is the only list, and everything else is derived from it. Miss it and the
 * model can never propose the screen. */

export const SCREENS = {
  home: ['create-invoice-cta', 'received-payment', 'reports'],
  'create-bill': ['party-field', 'add-items', 'scan-record'],
  'create-invoice': ['item-search', 'add-item-0', 'add-item-1', 'generate-bill'],
  'invoice-created': ['share', 'done'],
  'theme-store': ['theme-0', 'theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'variant-1', 'variant-2', 'unlock', 'close'],
  /* Five rows, not just the first: a clip that zooms at something in the
     middle of a shelf needs the middle to have a name. */
  items: ['create-new-item', 'bulk-action',
    'item-row-0', 'item-row-1', 'item-row-2', 'item-row-3', 'item-row-4', 'low-stock'],
  parties: ['party-row-0', 'party-row-1', 'send-reminder-0', 'shared-ledgers', 'create-party', 'search'],
  'scan-bills': ['open-camera', 'upload-pdf', 'browse-gallery'],
  'scan-camera': ['shutter', 'flip'],
  'scan-reading': [],
  'scan-done': [],
  'create-purchase': ['create-purchase', 'additional-charges', 'discount'],
  'create-item': ['item-name', 'hsn', 'tab-stock', 'batching', 'save'],
  /* Adding a customer or a supplier. "Create Party" was a button with nothing
     behind it in both shapes, so the first thing every new user does was the
     one process that could not be filmed. */
  'create-party': ['party-name', 'party-phone', 'type-supplier', 'opening-balance', 'gstin', 'save'],
  'share-sheet': ['contact-0', 'contact-1', 'send'],
  'wa-attach': ['caption', 'send'],
  'wa-chat': ['back', 'attachment'],
  /* myCashFlo - a different product, so its screens are named apart. */
  'mcf-dashboard': ['call-personally', 'outstanding', 'nav-parties', 'nav-automations'],
  'mcf-parties': ['setup-automation', 'search', 'filter-overdue', 'party-row-0', 'party-row-1', 'nav-dashboard', 'nav-automations'],
  'mcf-party': ['call', 'legal', 'share', 'pause-calls', 'add-automation', 'tab-whatsapp'],
  'mcf-automations': ['new-automation', 'automation-0', 'automation-1', 'nav-dashboard', 'nav-parties'],
  'mcf-tally': ['sync-now', 'tally-status', 'nav-dashboard', 'nav-parties'],
  'mcf-ai-call': ['end-call', 'listen', 'mute'],
  /* The call nobody answers, and the second number the AI rings instead. Every
     clip until now showed only the call that works, so a script that said the
     party did not pick up had nothing to cut to. */
  'mcf-ai-noanswer': ['try-alternate', 'end-call'],
  /* What has actually been tried on a party, in order - the beat that makes it
     persistence rather than one lucky phone call. */
  'mcf-attempts': ['attempt-0', 'attempt-1', 'call-again', 'pause-calls'],
  'mcf-desktop-history': ['attempt-0', 'attempt-3', 'nav-parties', 'nav-automations', 'ask-ai'],
  /* Tally, approximated - a cutaway, not a myBillBook screen. */
  'tally-receivables': ['f6-age-wise', 'f12-configure', 'bill-row-0'],
  /* Language and tone are choices a script asks for out loud - "Tamil mein
     baat karega", "legal notice bhej do" - so each one is a button a clip can
     be seen pressing. 'tone-firm' is gone; it is 'tone-assertive' now. */
  'mcf-new-automation': ['channel-ai', 'channel-whatsapp', 'channel-sms',
    'lang-hindi', 'lang-english', 'lang-hinglish',
    'tone-friendly', 'tone-assertive', 'tone-final', 'tone-legal', 'turn-on'],
  'mcf-ai-ringing': ['accept', 'decline'],
  /* The first screen drawn as a laptop rather than a phone. */
  /* Setting an automation up on a laptop is two steps in one sheet: configure
     it, then choose who it is pointed at and turn it on. The second step was
     missing, so a clip set up an automation that applied to nobody. */
  'mcf-desktop': ['ask-ai', 'setup-automation', 'party-row-0',
    'lang-hindi', 'lang-english', 'lang-hinglish',
    'tone-friendly', 'tone-assertive', 'tone-final', 'tone-legal',
    'continue', 'select-all', 'party-pick-0', 'party-pick-1', 'activate'],
  /* The rest of myCashFlo on a laptop. Without these a laptop collections clip
     had to start on the parties table and stop before anything was set up -
     half the process, which is the half that does not sell it. */
  'mcf-desktop-dashboard': ['call-personally', 'setup-followups', 'add-contact', 'outstanding', 'nav-parties', 'nav-automations', 'ask-ai'],
  'mcf-desktop-automations': ['new-automation', 'automation-0', 'automation-1', 'automation-2', 'edit-automation', 'edit-parties', 'nav-parties', 'nav-dashboard'],
  /* The laptop counterparts of the phone's dashboard and sales list. Same
     flow, wider interface - a laptop clip starts where a phone clip starts. */
  'mbb-desktop-dashboard': ['create-sales-invoice', 'to-collect', 'to-pay', 'transactions', 'collections'],
  'mbb-desktop-sales-list': ['new-bill', 'create-sales-invoice', 'bill-row-0', 'change-range', 'total-sales'],
  'mbb-desktop-reports': ['create-sales-invoice', 'change-range', 'net-profit', 'excel'],
  'mbb-desktop-create-item': ['item-name', 'hsn', 'tab-stock', 'batching', 'save'],
  'mbb-desktop-create-party': ['party-name', 'party-phone', 'type-supplier', 'opening-balance', 'gstin', 'save'],
  /* The Theme Store on a laptop puts the picker BESIDE the bill instead of in
     a sheet over it, which is the one thing a desk does better than a phone. */
  'mbb-desktop-theme-store': ['theme-0', 'theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'variant-1', 'variant-2', 'unlock', 'close'],
  /* Scan & Record on a laptop. A desk has no camera pointed at a bill, so the
     two ways in are a file dropped on the window and a photo sent across from
     the phone - the same flow as the phone's, which is the whole rule. */
  'mbb-desktop-scan': ['create-sales-invoice', 'upload-file', 'browse-files', 'add-from-phone', 'read-bill', 'scan-row-0'],
  'mbb-desktop-scan-reading': [],
  'mbb-desktop-scan-done': [],
  /* "create-sales-invoice" is the rail's own button, on every myBillBook
     laptop screen: it is where a laptop bill starts, the way the + Bill /
     Invoice pill is on the phone. */
  'mbb-desktop-parties': ['create-sales-invoice', 'create-party', 'to-collect', 'party-row-0', 'reports'],
  'mbb-desktop-items': ['create-sales-invoice', 'create-item', 'low-stock',
    'item-row-0', 'item-row-1', 'item-row-2', 'item-row-3', 'item-row-4', 'bulk-actions'],
  /* The billing flow itself: open the catalogue, search it, add lines, put
     them on the bill, save. The same beats as the phone's create-invoice. */
  'mbb-desktop-create-invoice': ['add-item', 'item-search', 'add-item-0', 'add-item-1', 'add-to-bill', 'save', 'add-party', 'upload', 'proceed'],
  'mbb-desktop-invoice': ['create-sales-invoice', 'record-payment', 'share', 'share-whatsapp', 'download-pdf', 'theme-store'],
  'mbb-desktop-purchase': ['add-item', 'item-search', 'add-item-0', 'add-item-1', 'add-to-bill', 'upload', 'proceed', 'save', 'add-party'],
  'sales-list': ['change-range', 'sort', 'filter-sales', 'bill-row-0', 'share-link', 'received-payment', 'new-bill'],
  'profit-loss': ['change-range', 'pdf', 'excel', 'net-profit']
} as const;

/* Derived, never typed out again. This was a hand-kept second list, and it
 * had fallen six screens behind SCREENS above - parties, the whole of Scan &
 * Record and create-purchase were all built, listed, and still impossible for
 * the model to propose, because this is what it is actually constrained to. */
export const SCREEN_NAMES = Object.keys(SCREENS) as [keyof typeof SCREENS, ...(keyof typeof SCREENS)[]];

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem', 'zoom', 'zoomOut', 'scroll'] as const;

/* Mirrors the PNGs in kit/themes/, plus the built-in CSS washes. A theme named
 * here but absent from that folder renders plain and warns - never fails. */
export const THEMES = ['none', 'warm', 'navaratri', 'durga-puja', 'dussehra', 'dhanteras', 'diwali', 'chhath-puja', 'gandhi-jayanti', 'ganesh-chaturthi', 'janmashtami', 'rakhi', 'onam', 'eid-e-milad', 'independence', 'shubh-ekadashi', 'jain-theme', 'industrial'] as const;

export const RecipeSchema = z.object({
  video: z.string(),
  business: z.object({ name: z.string(), gstin: z.string() }),
  party: z.object({ name: z.string(), phone: z.string() }),
  invoice: z.object({
    /* The renderer requires a positive whole number here, not a string.
     * A string is rejected by src/recipe.js and the render never starts. */
    number: z.number().int().positive(),
    date: z.string(),
    theme: z.enum(THEMES)
  }),
  items: z.array(
    z.object({
      name: z.string(),
      rate: z.number(),
      qty: z.number(),
      gst: z.number(),
      unit: z.string()
    })
  ),
  /* Figures a script says out loud. Without these fields a shot list had
   * nowhere to put "mera 4 lakh collect karna hai" or "market mein 52 lakh
   * atka hai", so the screens showed what they always showed and the video
   * contradicted its own voiceover. Null means the script never settled the
   * figure and the studio works it out from the rest of the recipe. */
  dashboard: z.object({
    toCollect: z.number().nullable(),
    toPay: z.number().nullable(),
    weekSale: z.number().nullable()
  }),
  /* The day's takings and what was left of them - the two figures a shopkeeper
   * says out loud most often. Without these the day's list and the Profit &
   * Loss showed their own arithmetic while the voiceover said something else.
   * Null means the script never settled it and the studio works it out. */
  sales: z.object({
    dayTotal: z.number().nullable(),
    netProfit: z.number().nullable()
  }),
  /* The collections book the myCashFlo screens read from. An empty list leaves
   * the studio's own stand-in parties in place. */
  cashflo: z.object({
    parties: z.array(
      z.object({
        name: z.string(),
        balance: z.number(),
        overdueDays: z.number()
      })
    )
  }),
  /* Nullable rather than optional: a strict output schema is more reliable
   * when every field is always present, so the model emits endCard: null when
   * the clip should not close on a branded card. Without this field at all,
   * no proposed recipe could ever have one. */
  brand: z.object({
    endCard: z.object({
      duration: z.number(),
      tagline: z.string()
    }).nullable()
  }),
  /* Anything the script calls for that no available screen can show. Always
   * present - an empty array when the screens cover everything - because a
   * strict output schema is more reliable when every field is. */
  unsupported: z.array(z.string()),
  shots: z.array(
    z.object({
      screen: z.enum(SCREEN_NAMES),
      duration: z.number(),
      actions: z.array(
        z.object({
          at: z.number(),
          do: z.enum(ACTIONS),
          target: z.string().optional(),
          text: z.string().optional(),
          index: z.number().int().optional(),
          /* scroll only: how far down the screen's list to move, in its own
             pixels. Left out, it moves a little over one card. */
          distance: z.number().optional(),
          duration: z.number().optional()
        })
      )
    })
  )
});

export type Recipe = z.infer<typeof RecipeSchema>;
