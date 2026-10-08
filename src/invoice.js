/* The invoice a video creates. Shared by the recipe parser and the screens so
 * a screen rendered without one still shows something plausible, not a blank. */

export const DEFAULT_INVOICE = { number: 1001, date: '01/01/2026' };

export function invoiceOf(data) {
  return { ...DEFAULT_INVOICE, ...(data?.invoice ?? {}) };
}
