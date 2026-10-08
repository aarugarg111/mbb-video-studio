/* Amount in words, Indian English: "Eight Hundred Rupees",
 * "One Lakh Twenty Five Thousand Rupees". Whole rupees only - a bill total is
 * rounded before it is printed. Indian grouping: thousand, lakh, crore. */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', rest ? below100(rest) : ''].filter(Boolean).join(' ');
}

export function numberToWords(n) {
  let rest = Math.floor(Math.abs(n));
  if (rest === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(rest / 10000000); rest %= 10000000;
  const lakh = Math.floor(rest / 100000); rest %= 100000;
  const thousand = Math.floor(rest / 1000); rest %= 1000;
  /* Crore can itself exceed 99 for very large sums, so it recurses. */
  if (crore) parts.push(numberToWords(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

export function amountInWords(n) {
  const rounded = Math.round(n);
  return (rounded < 0 ? 'Minus ' : '') + numberToWords(rounded) + (Math.abs(rounded) === 1 ? ' Rupee' : ' Rupees');
}
