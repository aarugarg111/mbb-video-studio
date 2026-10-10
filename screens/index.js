import * as home from './home.js';
import * as createBill from './create-bill.js';
import * as createInvoice from './create-invoice.js';
import * as invoiceCreated from './invoice-created.js';
import * as themeStore from './theme-store.js';
import * as items from './items.js';
import * as parties from './parties.js';
import * as scanBills from './scan-bills.js';
import * as scanCamera from './scan-camera.js';
import * as scanReading from './scan-reading.js';
import * as scanDone from './scan-done.js';
import * as createPurchase from './create-purchase.js';
import * as createItem from './create-item.js';
import * as shareSheet from './share-sheet.js';
import * as waAttach from './wa-attach.js';
import * as waChat from './wa-chat.js';
import * as mcfDashboard from './mcf-dashboard.js';
import * as mcfParties from './mcf-parties.js';
import * as mcfParty from './mcf-party.js';
import * as mcfAutomations from './mcf-automations.js';
import * as mcfTally from './mcf-tally.js';
import * as mcfAiCall from './mcf-ai-call.js';

export const SCREENS = {
  [home.name]: home,
  [createBill.name]: createBill,
  [createInvoice.name]: createInvoice,
  [invoiceCreated.name]: invoiceCreated,
  [themeStore.name]: themeStore,
  [items.name]: items,
  [parties.name]: parties,
  [scanBills.name]: scanBills,
  [scanCamera.name]: scanCamera,
  [scanReading.name]: scanReading,
  [scanDone.name]: scanDone,
  [createPurchase.name]: createPurchase,
  [createItem.name]: createItem,
  [shareSheet.name]: shareSheet,
  [waAttach.name]: waAttach,
  [waChat.name]: waChat,
  [mcfDashboard.name]: mcfDashboard,
  [mcfParties.name]: mcfParties,
  [mcfParty.name]: mcfParty,
  [mcfAutomations.name]: mcfAutomations,
  [mcfTally.name]: mcfTally,
  [mcfAiCall.name]: mcfAiCall
};

/* The shape src/recipe.js validates against: screen name -> its target names. */
export function catalogue() {
  const out = {};
  for (const [key, mod] of Object.entries(SCREENS)) {
    out[key] = Object.keys(mod.targets);
  }
  return out;
}
