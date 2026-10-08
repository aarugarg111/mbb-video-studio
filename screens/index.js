import * as home from './home.js';
import * as createInvoice from './create-invoice.js';
import * as invoiceCreated from './invoice-created.js';

export const SCREENS = {
  [home.name]: home,
  [createInvoice.name]: createInvoice,
  [invoiceCreated.name]: invoiceCreated
};

/* The shape src/recipe.js validates against: screen name -> its target names. */
export function catalogue() {
  const out = {};
  for (const [key, mod] of Object.entries(SCREENS)) {
    out[key] = Object.keys(mod.targets);
  }
  return out;
}
