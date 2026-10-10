import * as home from './home.js';
import * as createBill from './create-bill.js';
import * as createInvoice from './create-invoice.js';
import * as invoiceCreated from './invoice-created.js';
import * as items from './items.js';
import * as createItem from './create-item.js';

export const SCREENS = {
  [home.name]: home,
  [createBill.name]: createBill,
  [createInvoice.name]: createInvoice,
  [invoiceCreated.name]: invoiceCreated,
  [items.name]: items,
  [createItem.name]: createItem
};

/* The shape src/recipe.js validates against: screen name -> its target names. */
export function catalogue() {
  const out = {};
  for (const [key, mod] of Object.entries(SCREENS)) {
    out[key] = Object.keys(mod.targets);
  }
  return out;
}
