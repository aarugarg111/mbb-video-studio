/* Bill arithmetic and Indian currency formatting.
 *
 * The tax model is taken from the live app, not invented. On its Create
 * Purchase screen:
 *
 *   Item Subtotal   24199.81      <- what the item prices add up to
 *   Taxable Amount  20508.31      <- 24199.81 / 1.18
 *   Tax Applied      3691.50      <- the difference
 *     CGST@9.0%      1845.75      <- half
 *     SGST@9.0%      1845.75      <- half
 *   Round Off            0.19
 *   Total Amount       24200
 *
 * Two consequences worth stating plainly, because both are easy to get wrong:
 *   - PRICES ARE TAX-INCLUSIVE. Tax is extracted from the price, not added to
 *     it, so the taxable amount is BELOW the subtotal.
 *   - THE RATE IS PER ITEM. One bill showed 18% items, another 5%.
 *
 * Grouping is implemented by hand rather than with toLocaleString so that Node
 * and headless Chrome produce byte-identical output.
 */

export function formatINR(n) {
  const rounded = Math.round(n);
  const negative = rounded < 0;
  const digits = String(Math.abs(rounded));

  let grouped;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  return (negative ? '-₹' : '₹') + grouped;
}

/* The same grouping, to the paisa. The bill rounds to whole rupees, but the
 * purchase screen shows the tax split exactly - the app prints 20,508.31 and
 * 1,845.75 there, and a rounded 20,508 would not add up on screen. */
export function formatINR2(n) {
  const negative = n < 0;
  const fixed = Math.abs(n).toFixed(2);
  const [whole, paise] = fixed.split('.');

  let grouped;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3);
    grouped = rest.replace(/B(?=(d{2})+(?!d))/g, ',') + ',' + last3;
  }

  return (negative ? '-₹' : '₹') + grouped + '.' + paise;
}

/* The price the customer pays for this line, tax included. */
export function lineTotal(item) {
  return item.rate * item.qty;
}

/* The part of a line that is not tax. */
export function taxableOf(item) {
  const gst = item.gst ?? 0;
  return lineTotal(item) / (1 + gst / 100);
}

/* Everything the totals block on a bill needs, in one call. */
export function summarise(items) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const taxable = items.reduce((sum, item) => sum + taxableOf(item), 0);
  const tax = subtotal - taxable;
  const total = Math.round(subtotal);

  return {
    subtotal,
    taxable,
    tax,
    cgst: tax / 2,
    sgst: tax / 2,
    roundOff: total - subtotal,
    total
  };
}

export function billTotal(items) {
  return summarise(items).total;
}
