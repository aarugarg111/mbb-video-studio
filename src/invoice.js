/* The invoice a video creates. Shared by the recipe parser and the screens so
 * a screen rendered without one still shows something plausible, not a blank. */

/* Today, written the way every bill in the app writes it.
 *
 * The default used to be a fixed 01/01/2026, and recipes each pinned a date of
 * their own, so a clip rendered in October showed a bill dated January - or
 * dated a fortnight before the day it was filmed. A bill carries the day it
 * was written unless the script asks for another one. */
export function todayStamp(now = new Date()) {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${now.getFullYear()}`;
}

/* A function rather than a constant: a constant is the date the process
 * started, which is the same bug wearing a different hat on a server that
 * stays up for a week. */
export function defaultInvoice() {
  return { number: 1001, date: todayStamp() };
}

export function invoiceOf(data) {
  return { ...defaultInvoice(), ...(data?.invoice ?? {}) };
}

/* The name the app gives the PDF it shares:
 * <number>_sales_invoice_<PARTY NAME>.pdf, upper-case, spaces as underscores. */
export function invoiceFileName(data) {
  const party = String(data?.party?.name ?? "Cash Sale")
    .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${invoiceOf(data).number}_sales_invoice_${party || "CASH_SALE"}.pdf`;
}
