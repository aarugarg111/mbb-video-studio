/* What each screen and each button is called in the form.
 *
 * The shot list underneath is unchanged - these are names for people who did
 * not write the renderer. "sales-list" is the day's bills; "change-range" is
 * narrowing it to today. Nobody filling in a form for a creator's script
 * should have to learn either.
 *
 * Anything with no entry here falls back to a tidied version of its own id,
 * so a screen added to SCREENS still appears in the form with a readable name
 * rather than vanishing from it. Adding it below is then an improvement, not
 * a repair.
 */

import { SCREENS } from './schema';
import { scrollables } from '../../screens/index.js';

type ScreenName = keyof typeof SCREENS;

const SCREEN_LABELS: Partial<Record<ScreenName, { name: string; blurb: string }>> = {
  home: { name: 'Home screen', blurb: 'To collect, to pay, the week' },
  'sales-list': { name: "Day's bills", blurb: 'Every sale, newest first' },
  'profit-loss': { name: 'Profit & Loss', blurb: 'What was left of the takings' },
  'create-bill': { name: 'Start a bill', blurb: 'Pick the customer' },
  'create-invoice': { name: 'Make a bill', blurb: 'Add items and save' },
  'invoice-created': { name: 'The finished bill', blurb: 'Print, download, share' },
  'theme-store': { name: 'Theme Store', blurb: 'Festival designs for the bill' },
  items: { name: 'Items', blurb: 'Stock and prices' },
  'create-item': { name: 'Add an item', blurb: 'Name, price, stock' },
  parties: { name: 'Customers', blurb: 'Who owes what' },
  'create-party': { name: 'Add a customer', blurb: 'Name, number, opening balance' },
  'create-purchase': { name: 'Record a purchase', blurb: 'A bill you were given' },
  'scan-bills': { name: 'Scan a bill', blurb: 'Photograph a purchase bill' },
  'scan-camera': { name: 'The camera', blurb: 'Pointing at the bill' },
  'scan-reading': { name: 'Reading the bill', blurb: 'The wait, which is short' },
  'scan-done': { name: 'Bill read', blurb: 'What it saved you' },
  'share-sheet': { name: 'Share with', blurb: 'Pick who gets it' },
  'wa-attach': { name: 'WhatsApp', blurb: 'The bill, attached' },
  'wa-chat': { name: 'WhatsApp chat', blurb: 'Sent, and read' },
  'mcf-dashboard': { name: 'myCashFlo · Dashboard', blurb: 'What is stuck' },
  'mcf-parties': { name: 'myCashFlo · Who owes you', blurb: 'Worst first' },
  'mcf-party': { name: 'myCashFlo · One customer', blurb: 'What has been tried' },
  'mcf-automations': { name: 'myCashFlo · Chasing', blurb: 'What keeps running' },
  'mcf-new-automation': { name: 'myCashFlo · Set up chasing', blurb: 'Language, tone, how often' },
  'mcf-tally': { name: 'myCashFlo · Tally sync', blurb: 'Pulling the outstanding across' },
  'mcf-ai-call': { name: 'myCashFlo · The AI calls', blurb: 'The customer picks up' },
  'mcf-ai-ringing': { name: 'myCashFlo · Ringing', blurb: 'As the customer sees it' },
  'mcf-ai-noanswer': { name: 'myCashFlo · No answer', blurb: 'And the other number' },
  'mcf-attempts': { name: 'myCashFlo · Follow-up history', blurb: 'Everything tried, in order' },
  'tally-receivables': { name: 'Tally · Bills Receivable', blurb: 'On the computer' },
  'mcf-desktop': { name: 'myCashFlo · Who owes you', blurb: 'The whole book at once' },
  'mcf-desktop-dashboard': { name: 'myCashFlo · Dashboard', blurb: 'Who needs attention' },
  'mcf-desktop-automations': { name: 'myCashFlo · Chasing', blurb: 'What keeps running' },
  'mcf-desktop-history': { name: 'myCashFlo · History', blurb: 'Everything tried' },
  'mbb-desktop-dashboard': { name: 'Dashboard', blurb: 'The laptop home screen' },
  'mbb-desktop-sales-list': { name: "Day's bills", blurb: 'Total sales, paid, unpaid' },
  'mbb-desktop-reports': { name: 'Reports', blurb: 'Profit and loss' },
  'mbb-desktop-parties': { name: 'Customers', blurb: 'Who owes what' },
  'mbb-desktop-items': { name: 'Items', blurb: 'Stock and prices' },
  'mbb-desktop-create-item': { name: 'Add an item', blurb: 'In a window over the list' },
  'mbb-desktop-create-party': { name: 'Add a customer', blurb: 'In a window over the list' },
  'mbb-desktop-create-invoice': { name: 'Make a bill', blurb: 'The laptop billing form' },
  'mbb-desktop-invoice': { name: 'The finished bill', blurb: 'Share, print, record payment' },
  'mbb-desktop-purchase': { name: 'Record a purchase', blurb: 'A bill you were given' },
  'mbb-desktop-theme-store': { name: 'Theme Store', blurb: 'The picker beside the bill' },
  'mbb-desktop-scan': { name: 'Scan a bill', blurb: 'Drop a file, or send from the phone' },
  'mbb-desktop-scan-reading': { name: 'Reading the bill', blurb: 'The wait, which is short' },
  'mbb-desktop-scan-done': { name: 'Bill read', blurb: 'What it saved you' }
};

/* Buttons. Keyed by name alone, because the same name means the same thing
 * wherever it appears - "save" saves on every screen that has one. Where a
 * screen needs its own wording, "screen/target" wins over the bare name. */
const STEP_LABELS: Record<string, string> = {
  'change-range': 'Narrow it to today',
  sort: 'Sort the list',
  'filter-sales': 'Show sales only',
  'bill-row-0': 'Open the first bill',
  'share-link': 'Share a payment link',
  'received-payment': 'Record a payment',
  'new-bill': 'Start a new bill',
  'create-invoice-cta': 'Tap + Bill / Invoice',
  reports: 'Open Reports',
  'net-profit': 'Point at Net Profit',
  pdf: 'Download the PDF',
  excel: 'Download the Excel',
  'party-field': 'Pick the customer',
  'add-items': 'Add items',
  'scan-record': 'Scan it instead',
  'item-search': 'Search for an item',
  'add-item': 'Open the item list',
  'add-item-0': 'Add the first item',
  'add-item-1': 'Add the second item',
  'add-to-bill': 'Put them on the bill',
  'generate-bill': 'Save the bill',
  save: 'Save',
  share: 'Share it',
  done: 'Done',
  'record-payment': 'Record the payment',
  'share-whatsapp': 'Send it on WhatsApp',
  'download-pdf': 'Download the PDF',
  'theme-store': 'Open the Theme Store',
  'theme-0': 'Pick the first theme',
  'theme-1': 'Pick the second theme',
  'theme-2': 'Pick the third theme',
  'variant-1': 'Use the first design',
  'variant-2': 'Use the second design',
  unlock: 'Unlock themes',
  close: 'Close it',
  'create-new-item': 'Add an item',
  'create-item': 'Add an item',
  'create-party': 'Add a customer',
  'item-row-0': 'Open the first item',
  'low-stock': 'Show what is running out',
  'bulk-action': 'Bulk actions',
  'bulk-actions': 'Bulk actions',
  'party-row-0': 'Open the first customer',
  'party-row-1': 'Open the second customer',
  'send-reminder-0': 'Send a reminder',
  'shared-ledgers': 'Shared ledgers',
  search: 'Search',
  'open-camera': 'Open the camera',
  'upload-pdf': 'Upload a PDF',
  'browse-gallery': 'Browse the gallery',
  'upload-file': 'Drop a file on the window',
  'browse-files': 'Browse for a file',
  'add-from-phone': 'Send the photo from your phone',
  'read-bill': 'Read this bill',
  shutter: 'Take the photo',
  'item-name': 'Type the name',
  hsn: 'Fill the HSN code',
  'tab-stock': 'Open Stock details',
  batching: 'Turn on batching',
  'party-name': 'Type the name',
  'party-phone': 'Fill the mobile number',
  'type-supplier': 'Make them a supplier',
  'opening-balance': 'Set the opening balance',
  gstin: 'Fill the GSTIN',
  'contact-0': 'Pick the first contact',
  'contact-1': 'Pick the second contact',
  send: 'Send',
  caption: 'Type a message',
  'call-personally': 'Call them yourself',
  outstanding: 'Point at what is stuck',
  'setup-automation': 'Set up chasing',
  'setup-followups': 'Set up follow-ups',
  'add-contact': 'Add a contact number',
  'new-automation': 'Set up chasing',
  'automation-0': 'Open the first one',
  'automation-1': 'Open the second one',
  'automation-2': 'Open the third one',
  'edit-automation': 'Edit it',
  'edit-parties': 'Change who it chases',
  'channel-ai': 'Let the AI call',
  'channel-whatsapp': 'Send WhatsApp instead',
  'channel-sms': 'Send an SMS instead',
  'lang-hindi': 'Speak Hindi',
  'lang-english': 'Speak English',
  'lang-hinglish': 'Speak Hinglish',
  'tone-friendly': 'Keep it friendly',
  'tone-assertive': 'Be assertive',
  'tone-final': 'Send a final notice',
  'tone-legal': 'Threaten legal action',
  'turn-on': 'Turn it on',
  continue: 'Continue',
  'select-all': 'Select everyone',
  'party-pick-0': 'Pick the first customer',
  'party-pick-1': 'Pick the second customer',
  activate: 'Turn it on',
  'sync-now': 'Sync now',
  'tally-status': 'Point at the sync',
  call: 'Call them',
  legal: 'Legal notice',
  'pause-calls': 'Pause the calls',
  'add-automation': 'Set up chasing',
  'tab-whatsapp': 'Open the WhatsApp tab',
  'try-alternate': 'Try the other number',
  'end-call': 'End the call',
  'attempt-0': 'The first attempt',
  'attempt-1': 'The second attempt',
  'attempt-3': 'The one that worked',
  'call-again': 'Call again',
  'ask-ai': 'Tell the AI what to do',
  'to-collect': 'Point at what is owed',
  'to-pay': 'Point at what you owe',
  transactions: "Open the day's bills",
  collections: 'Open collections',
  'create-sales-invoice': 'Start a new bill',
  'total-sales': 'Point at the total',
  'f6-age-wise': 'Age-wise (F6)',
  'f12-configure': 'Configure (F12)',
  'nav-dashboard': 'Go to the dashboard',
  'nav-parties': 'Go to the customers',
  'nav-automations': 'Go to the chasing',
  'nav-history': 'Go to the history',
  'add-party': 'Pick the customer',
  upload: 'Let Mira read a bill',
  proceed: 'Use what it read',
  flip: 'Flip the camera',
  back: 'Go back',
  attachment: 'Open the attachment',
  accept: 'Answer it',
  decline: 'Decline it',
  listen: 'Listen in',
  mute: 'Mute',
  'manage-staff': 'Manage staff'
};

/* "someScreen-name" -> "Some screen name", for anything with no entry above.
 * Readable, never wrong, and obviously a fallback rather than a decision. */
function tidy(id: string): string {
  const words = id.replace(/[-_]/g, ' ').replace(/\b(\d+)\b/g, m => `#${Number(m) + 1}`);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function screenLabel(screen: string): { name: string; blurb: string } {
  return SCREEN_LABELS[screen as ScreenName] ?? { name: tidy(screen), blurb: '' };
}

export function stepLabel(screen: string, target: string): string {
  return STEP_LABELS[`${screen}/${target}`] ?? STEP_LABELS[target] ?? tidy(target);
}

/* What can happen on a screen, in the order the form offers them: everything
 * that can be tapped, plus a scroll where the screen has a list long enough
 * to need one. */
/* Which screens have a list worth scrolling. Read from the screens
 * themselves, never written down twice: a hand-kept copy of this is exactly
 * what made the studio refuse every scroll - the command line knew and the
 * page did not. */
export const SCROLLABLE: string[] = scrollables();

export function stepsFor(screen: string): { id: string; name: string; scroll?: boolean }[] {
  const targets = (SCREENS as Record<string, readonly string[]>)[screen] ?? [];
  const steps: { id: string; name: string; scroll?: boolean }[] =
    targets.map(id => ({ id, name: stepLabel(screen, id) }));
  if (SCROLLABLE.includes(screen)) {
    steps.push({ id: '__scroll', name: 'Scroll down the list', scroll: true });
  }
  return steps;
}

/* Places inside a bill, which are looked at rather than pressed. */
export const PLACE_LABELS: Record<string, string> = {
  customer: 'the customer',
  'mobile-number': 'their mobile number',
  'invoice-number': 'the invoice number',
  'invoice-date': 'the date',
  'bill-items': 'the items on the bill',
  totals: 'the totals',
  balance: 'what is still owed'
};
