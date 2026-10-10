/* The collections book the myCashFlo screens all read from.
 *
 * Three screens show the same money from different angles: the dashboard's
 * total outstanding, the list of who owes it, and one party's own page. If
 * each invented its own figures the video would contradict itself on camera -
 * a total that is not the sum of the list under it is exactly the kind of
 * detail a viewer notices. So the book is built once, here.
 *
 * Every party in it is INVENTED. The reference recording is of a real shop
 * and its screens are full of real names and a real phone number; none of
 * that may reach the code, a test, a recipe or a commit message.
 */

/* Overdue days are fixed per filler rather than derived from today's date:
 * a render must be reproducible, and "97d overdue" changing overnight would
 * make two renders of the same recipe different files. */
const FILLERS = [
  { name: 'SURESH TRADERS', balance: 310000, overdueDays: 103, standby: 3 },
  { name: 'Meena Sharma', balance: 260000, overdueDays: 0, standby: 3 },
  { name: 'Anil Distributors', balance: 150000, overdueDays: 0, standby: 3 },
  { name: 'Vikram Stores', balance: 150000, overdueDays: 288, standby: 1 },
  { name: 'Lata Enterprises', balance: 120000, overdueDays: 41, standby: 2 },
  { name: 'Gupta Agencies', balance: 84000, overdueDays: 12, standby: 3 },
  { name: 'Rakesh Kumar', balance: 9000, overdueDays: 6, standby: 1 }
];

/* Why a party is being chased. The app shows these as pills on the dashboard. */
export const REASONS = ['Disputing Amount', 'No Response', 'Promised to Pay'];

export const DEFAULT_WALLET = 2967.5;

/* myCashFlo writes money short - ₹14.9L, ₹8.4K, ₹900 - because a collections
 * screen is a list of large numbers and the full digits would not fit. Done by
 * hand rather than with toLocaleString, which disagrees between Node and
 * Chrome on some builds; the two render paths have to produce the same pixels. */
export function short(n) {
  const v = Math.round(Math.abs(Number(n) || 0));
  const trim = x => String(x).replace(/\.0$/, '');
  if (v >= 10000000) return '₹' + trim((Math.round(v / 100000) / 100).toFixed(1)) + 'Cr';
  if (v >= 100000) return '₹' + trim((Math.round(v / 10000) / 10).toFixed(1)) + 'L';
  if (v >= 1000) return '₹' + trim((Math.round(v / 100) / 10).toFixed(1)) + 'K';
  return '₹' + v;
}

/* The wallet balance is the one figure the app writes out in full, with paise,
 * because it is money sitting in an account rather than a total being summed. */
export function rupeesExact(n) {
  const v = Math.abs(Number(n) || 0).toFixed(2);
  const [whole, paise] = v.split('.');
  if (whole.length <= 3) return whole + '.' + paise;
  const tail = whole.slice(-3);
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return head + ',' + tail + '.' + paise;
}

/* The standard Indian placeholder, which is what the rest of this repo's
 * recipes already use - the equivalent of 555-0100. Never a number read off
 * the reference recording: those are real, the clips are published, and a
 * viewer could ring one. */
export const PLACEHOLDER_PHONE = '98765 43210';

export function phoneOf(party) {
  return party?.phone ? String(party.phone) : PLACEHOLDER_PHONE;
}

/* The recipe's own party leads the book, so the clip is about the customer the
 * script names rather than a stranger. */
export function ledger(data) {
  const named = data?.party?.name ?? data?.invoice?.party?.name;
  const own = named
    ? [{
        name: named,
        balance: Number(data?.party?.balance ?? 150000),
        overdueDays: Number(data?.party?.overdueDays ?? 288),
        standby: Number(data?.party?.standby ?? 1),
        phone: data?.party?.phone
      }]
    : [];

  /* A script that says a figure out loud - "market mein mera 52 lakh atka hai"
   * - needs the screen to show that figure, or the video contradicts its own
   * voiceover. So a recipe may name the whole book, and the fillers are only
   * there for scripts that do not. */
  const given = Array.isArray(data?.cashflo?.parties) ? data.cashflo.parties : [];
  const extra = given.map(p => ({
    name: String(p?.name ?? 'Party'),
    balance: Number(p?.balance ?? 0),
    overdueDays: Number(p?.overdueDays ?? 0),
    standby: Number(p?.standby ?? 1),
    phone: p?.phone
  }));

  const listed = [...own, ...extra];
  /* Whoever the recipe named is already in the book; a filler of the same name
   * would list them twice. */
  const rest = FILLERS.filter(f => !listed.some(o => o.name.toLowerCase() === f.name.toLowerCase()));
  /* Fillers only pad a book the recipe did not fill itself. */
  const parties = (extra.length ? listed : [...listed, ...rest]).slice(0, 7);

  const outstanding = parties.reduce((sum, p) => sum + p.balance, 0);
  const overdue = parties.filter(p => p.overdueDays > 0).reduce((sum, p) => sum + p.balance, 0);

  return {
    parties,
    outstanding,
    overdue,
    /* Nothing in the book falls due in the next few days, which is what the
     * app showed: a collections screen is about what is already late. */
    dueSoon: 0,
    wallet: Number(data?.cashflo?.wallet ?? DEFAULT_WALLET)
  };
}

/* The dashboard's sideways strip: two parties to a card, with a reason each.
 * The second card carries the count of everyone still behind it, which is what
 * the app puts there. */
export function attentionCards(book) {
  const late = book.parties
    .filter(p => p.overdueDays > 0)
    .map((p, i) => ({ ...p, reason: REASONS[i % REASONS.length] }));

  const first = late.slice(0, 2);
  const second = late.slice(2, 4);
  const cards = [{ parties: first, more: 0 }];
  if (second.length) cards.push({ parties: second, more: Math.max(late.length - 4, 0) });
  return cards;
}
