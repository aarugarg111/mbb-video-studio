/* The invoice a video creates. Shared by the recipe parser and the screens so
 * a screen rendered without one still shows something plausible, not a blank. */

export const DEFAULT_INVOICE = { number: 1001, date: '01/01/2026' };

export function invoiceOf(data) {
  return { ...DEFAULT_INVOICE, ...(data?.invoice ?? {}) };
}

/* The name the app gives the PDF it shares:
 * <number>_sales_invoice_<PARTY NAME>.pdf, upper-case, spaces as underscores. */
export function invoiceFileName(data) {
  const party = String(data?.party?.name ?? "Cash Sale")
    .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${invoiceOf(data).number}_sales_invoice_${party || "CASH_SALE"}.pdf`;
}
