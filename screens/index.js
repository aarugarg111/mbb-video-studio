import * as home from './home.js';
import * as createBill from './create-bill.js';
import * as createInvoice from './create-invoice.js';
import * as invoiceCreated from './invoice-created.js';
import * as themeStore from './theme-store.js';
import * as items from './items.js';
import * as createItem from './create-item.js';
import * as shareSheet from './share-sheet.js';
import * as waAttach from './wa-attach.js';
import * as waChat from './wa-chat.js';

export const SCREENS = {
  [home.name]: home,
  [createBill.name]: createBill,
  [createInvoice.name]: createInvoice,
  [invoiceCreated.name]: invoiceCreated,
  [themeStore.name]: themeStore,
  [items.name]: items,
  [createItem.name]: createItem,
  [shareSheet.name]: shareSheet,
  [waAttach.name]: waAttach,
  [waChat.name]: waChat
};

/* The shape src/recipe.js validates against: screen name -> its target names. */
export function catalogue() {
  const out = {};
  for (const [key, mod] of Object.entries(SCREENS)) {
    out[key] = Object.keys(mod.targets);
  }
  return out;
}
