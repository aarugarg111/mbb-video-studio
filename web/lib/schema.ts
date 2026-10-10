import { z } from 'zod';

/* Mirrors what src/recipe.js accepts. The model is constrained to this shape,
 * but the renderer's own parser remains the authority - whatever comes back is
 * validated there before anyone sees it.
 *
 * When a screen is added to screens/index.js, add it here too, or the model
 * will never propose it. */

export const SCREENS = {
  home: ['create-invoice-cta', 'received-payment'],
  'create-bill': ['party-field', 'add-items', 'scan-record'],
  'create-invoice': ['item-search', 'add-item-0', 'add-item-1', 'generate-bill'],
  'invoice-created': ['share', 'done']
} as const;

export const SCREEN_NAMES = ['home', 'create-bill', 'create-invoice', 'invoice-created'] as const;

export const ACTIONS = ['tap', 'type', 'selectParty', 'addItem'] as const;

/* Mirrors the PNGs in kit/themes/, plus the built-in CSS washes. A theme named
 * here but absent from that folder renders plain and warns - never fails. */
export const THEMES = ['none', 'warm'] as const;

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
