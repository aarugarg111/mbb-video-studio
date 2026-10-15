/* Filming the same shot list on a laptop instead of a phone, or the other way.
 *
 * The studio asks which shape the clip is filmed in and passed that answer to
 * the model as an instruction. An instruction is a request, not a guarantee:
 * the script's own UI markers name phone screens, and a shot list came back
 * full of phone screens however the picker was set. Choosing "a laptop" and
 * getting a phone video is the picker not working, whatever the prompt says.
 *
 * So the answer is applied to the recipe here, after the model has written it,
 * where it is a swap rather than a request. The model still gets told - a shot
 * list written in the right shape to begin with keeps more of its actions than
 * one recast afterwards.
 */

/* Which laptop screen stands in for which phone screen. Two phone screens can
 * share one laptop screen: a laptop shows the form and the items at once, so
 * create-bill and create-invoice are the same page on a wider screen. */
const ON_A_LAPTOP = {
  home: 'mbb-desktop-dashboard',
  'sales-list': 'mbb-desktop-sales-list',
  'profit-loss': 'mbb-desktop-reports',
  'create-item': 'mbb-desktop-create-item',
  'create-party': 'mbb-desktop-create-party',
  'theme-store': 'mbb-desktop-theme-store',
  'scan-bills': 'mbb-desktop-scan',
  'scan-camera': 'mbb-desktop-scan',
  'scan-reading': 'mbb-desktop-scan-reading',
  'scan-done': 'mbb-desktop-scan-done',
  'share-sheet': 'mbb-desktop-invoice',
  parties: 'mbb-desktop-parties',
  items: 'mbb-desktop-items',
  'create-bill': 'mbb-desktop-create-invoice',
  'create-invoice': 'mbb-desktop-create-invoice',
  'invoice-created': 'mbb-desktop-invoice',
  'create-purchase': 'mbb-desktop-purchase',
  'mcf-parties': 'mcf-desktop',
  'mcf-party': 'mcf-desktop',
  'mcf-dashboard': 'mcf-desktop-dashboard',
  'mcf-automations': 'mcf-desktop-automations',
  'mcf-attempts': 'mcf-desktop-history',
  'mcf-new-automation': 'mcf-desktop'
};

/* Going back the other way cannot simply reverse the table above, because the
 * laptop screen that stood in for two phone screens has to pick one. It picks
 * the one the laptop screen actually shows. */
const ON_A_PHONE = {
  'mbb-desktop-dashboard': 'home',
  'mbb-desktop-sales-list': 'sales-list',
  'mbb-desktop-reports': 'profit-loss',
  'mbb-desktop-create-item': 'create-item',
  'mbb-desktop-parties': 'parties',
  'mbb-desktop-items': 'items',
  'mbb-desktop-create-invoice': 'create-invoice',
  'mbb-desktop-invoice': 'invoice-created',
  'mbb-desktop-purchase': 'create-purchase',
  'mcf-desktop': 'mcf-parties',
  'mcf-desktop-dashboard': 'mcf-dashboard',
  'mcf-desktop-automations': 'mcf-automations',
  'mcf-desktop-history': 'mcf-attempts',
  'mbb-desktop-create-party': 'create-party',
  'mbb-desktop-theme-store': 'theme-store'
};

/* What a tap becomes on the other screen. Only where the name differs and the
 * button is genuinely the same button: "Create New Item" and "Create Item" are
 * one button in two widths, but a phone's "Send Reminder" row has no laptop
 * equivalent at all, so a tap on it is dropped rather than aimed at something
 * else. Aiming it elsewhere would put a ripple on the wrong control, which is
 * worse than a beat that simply holds. */
const SAME_BUTTON = {
  'create-new-item': 'create-item',
  'bulk-action': 'bulk-actions',
  /* Billing is the same flow in both shapes - open the form, add items, save -
   * so each beat of it has a button on the other side. The laptop's item
   * catalogue opens in a window rather than filling the screen, which is the
   * only difference a recast has to carry. */
  'add-items': 'add-item',
  'item-search': 'item-search',
  'add-item-0': 'add-item-0',
  'add-item-1': 'add-item-1',
  'party-field': 'add-party',
  'generate-bill': 'save',
  'scan-record': 'upload',
  /* Scan & Record. A laptop has no camera pointed at a bill, so the phone's
   * "Open Camera" becomes the laptop's "Add image from phone" - the same step,
   * done the way a desk does it - and "Upload PDF" stays an upload. */
  'open-camera': 'add-from-phone',
  'upload-pdf': 'upload-file',
  'browse-gallery': 'browse-files',
  'create-purchase': 'save',
  'new-automation': 'setup-automation',
  'turn-on': 'continue',
  /* The dashboard and the sales list carry the same buttons in both shapes. */
  'create-invoice-cta': 'create-sales-invoice',
  'new-bill': 'new-bill',
  'bill-row-0': 'bill-row-0',
  'change-range': 'change-range',
  'net-profit': 'net-profit',
  excel: 'excel',
  /* Create Item carries the same fields in both shapes. */
  'contact-0': 'share-whatsapp',
  'item-name': 'item-name',
  hsn: 'hsn',
  'tab-stock': 'tab-stock',
  batching: 'batching',
  save: 'save',
  'item-row-0': 'item-row-0',
  'party-row-0': 'party-row-0',
  'create-party': 'create-party',
  'low-stock': 'low-stock',
  'setup-automation': 'setup-automation',
  share: 'share'
};

/* The same table read backwards, for a laptop shot list recast onto a phone. */
const SAME_BUTTON_BACK = Object.fromEntries(
  Object.entries(SAME_BUTTON).map(([phone, laptop]) => [laptop, phone])
);

export function screenOnShape(screen, shape) {
  if (shape === 'laptop') return ON_A_LAPTOP[screen] ?? screen;
  if (shape === 'phone') return ON_A_PHONE[screen] ?? screen;
  return screen;
}

/* A target survives if the new screen has a button of that name, or has the
 * button this one turns into. Anything else is dropped. */
function targetOnShape(target, screen, shape, catalogue) {
  const buttons = catalogue?.[screen] ?? [];
  if (buttons.includes(target)) return target;
  const table = shape === 'phone' ? SAME_BUTTON_BACK : SAME_BUTTON;
  const moved = table[target];
  return moved && buttons.includes(moved) ? moved : null;
}

/* Two shots of one screen in a row read as a cut to nowhere - the picture does
 * not change, so the viewer thinks the video has stalled. They only appear
 * because two phone screens became one laptop screen, so they are joined back
 * into a single longer shot with the later shot's actions moved along. */
function joinRepeats(shots) {
  const joined = [];
  for (const shot of shots) {
    const last = joined[joined.length - 1];
    if (last && last.screen === shot.screen) {
      const offset = last.duration;
      last.actions = [
        ...(last.actions ?? []),
        ...(shot.actions ?? []).map(a => ({ ...a, at: Number((Number(a.at) + offset).toFixed(3)) }))
      ];
      last.duration = Number((last.duration + shot.duration).toFixed(3));
    } else {
      joined.push({ ...shot, actions: shot.actions ? [...shot.actions] : undefined });
    }
  }
  return joined;
}

/* recipe in, recipe out, alongside the taps that had no equivalent on the other
 * shape so the studio can say so rather than quietly filming less. An empty or
 * unknown shape leaves the recipe alone, which is what "let the script decide"
 * means. */
export function recastShape(recipe, shape, catalogue = {}) {
  if (shape !== 'laptop' && shape !== 'phone') return { recipe, dropped: [] };
  if (!recipe || !Array.isArray(recipe.shots)) return { recipe, dropped: [] };

  const dropped = [];

  const shots = recipe.shots.map(shot => {
    const screen = screenOnShape(shot.screen, shape);
    if (screen === shot.screen) return shot;

    const actions = (shot.actions ?? []).map(action => {
      if (!action?.target) return action;
      const target = targetOnShape(action.target, screen, shape, catalogue);
      if (!target) {
        dropped.push(`${action.target} on ${shot.screen}`);
        return null;
      }
      return target === action.target ? action : { ...action, target };
    }).filter(Boolean);

    return { ...shot, screen, ...(shot.actions ? { actions } : {}) };
  });

  return { recipe: { ...recipe, shots: joinRepeats(shots) }, dropped };
}
