import { z } from 'zod';

/* Mirrors what src/recipe.js accepts. The model is constrained to this shape,
 * but the renderer's own parser remains the authority - whatever comes back is
 * validated there before anyone sees it.
 *
 * When a screen is added to screens/index.js, add it to SCREENS below - that
 * is the only list, and everything else is derived from it. Miss it and the
 * model can never propose the screen. */

export const SCREENS = {
  home: ['create-invoice-cta', 'received-payment'],
  'create-bill': ['party-field', 'add-items', 'scan-record'],
  'create-invoice': ['item-search', 'add-item-0', 'add-item-1', 'generate-bill'],
  'invoice-created': ['share', 'done'],
  'theme-store': ['theme-0', 'theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'variant-1', 'variant-2', 'unlock', 'close'],
  items: ['create-new-item', 'bulk-action', 'item-row-0', 'low-stock'],
  parties: ['party-row-0', 'party-row-1', 'send-reminder-0', 'shared-ledgers', 'create-party', 'search'],
  'scan-bills': ['open-camera', 'upload-pdf', 'browse-gallery'],
  'scan-camera': ['shutter', 'flip'],
  'scan-reading': [],
  'scan-done': [],
  'create-purchase': ['create-purchase', 'additional-charges', 'discount'],
  'create-item': ['item-name', 'hsn', 'tab-stock', 'batching', 'save'],
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
  /* Tally, approximated - a cutaway, not a myBillBook screen. */
  'tally-receivables': ['f6-age-wise', 'f12-configure', 'bill-row-0'],
  'mcf-new-automation': ['channel-ai', 'channel-whatsapp', 'channel-sms', 'tone-firm', 'turn-on'],
  'mcf-ai-ringing': ['accept', 'decline'],
  /* The first screen drawn as a laptop rather than a phone. */
  'mcf-desktop': ['ask-ai', 'setup-automation', 'party-row-0', 'continue']
} as const;

/* Derived, never typed out again. This was a hand-kept second list, and it
 * had fallen six screens behind SCREENS above - parties, the whole of Scan &
 * Record and create-purchase were all built, listed, and still impossible for
 * the model to propose, because this is what it is actually constrained to. */
export const SCREEN_NAMES = Object.keys(SCREENS) as [keyof typeof SCREENS, ...(keyof typeof SCREENS)[]];

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem'] as const;

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
          duration: z.number().optional()
        })
      )
    })
  )
});

export type Recipe = z.infer<typeof RecipeSchema>;
