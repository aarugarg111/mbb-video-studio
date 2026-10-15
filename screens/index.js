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
import * as tallyReceivables from './tally-receivables.js';
import * as mcfNewAutomation from './mcf-new-automation.js';
import * as mcfAiRinging from './mcf-ai-ringing.js';
import * as mcfDesktop from './mcf-desktop.js';
import * as mbbDesktopDashboard from './mbb-desktop-dashboard.js';
import * as mbbDesktopSalesList from './mbb-desktop-sales-list.js';
import * as mbbDesktopReports from './mbb-desktop-reports.js';
import * as mbbDesktopCreateItem from './mbb-desktop-create-item.js';
import * as mbbDesktopScan from './mbb-desktop-scan.js';
import * as mbbDesktopScanReading from './mbb-desktop-scan-reading.js';
import * as mbbDesktopScanDone from './mbb-desktop-scan-done.js';
import * as mbbDesktopParties from './mbb-desktop-parties.js';
import * as mbbDesktopItems from './mbb-desktop-items.js';
import * as mbbDesktopCreateInvoice from './mbb-desktop-create-invoice.js';
import * as mbbDesktopInvoice from './mbb-desktop-invoice.js';
import * as mbbDesktopPurchase from './mbb-desktop-purchase.js';
import * as salesList from './sales-list.js';
import * as profitLoss from './profit-loss.js';

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
  [mcfAiCall.name]: mcfAiCall,
  [tallyReceivables.name]: tallyReceivables,
  [mcfNewAutomation.name]: mcfNewAutomation,
  [mcfAiRinging.name]: mcfAiRinging,
  [mcfDesktop.name]: mcfDesktop,
  [mbbDesktopDashboard.name]: mbbDesktopDashboard,
  [mbbDesktopSalesList.name]: mbbDesktopSalesList,
  [mbbDesktopScan.name]: mbbDesktopScan,
  [mbbDesktopScanReading.name]: mbbDesktopScanReading,
  [mbbDesktopScanDone.name]: mbbDesktopScanDone,
  [mbbDesktopReports.name]: mbbDesktopReports,
  [mbbDesktopCreateItem.name]: mbbDesktopCreateItem,
  [mbbDesktopParties.name]: mbbDesktopParties,
  [mbbDesktopItems.name]: mbbDesktopItems,
  [mbbDesktopCreateInvoice.name]: mbbDesktopCreateInvoice,
  [mbbDesktopInvoice.name]: mbbDesktopInvoice,
  [mbbDesktopPurchase.name]: mbbDesktopPurchase,
  [salesList.name]: salesList,
  [profitLoss.name]: profitLoss
};

/* The shape src/recipe.js validates against: screen name -> its target names. */
export function catalogue() {
  const out = {};
  for (const [key, mod] of Object.entries(SCREENS)) {
    out[key] = Object.keys(mod.targets);
  }
  return out;
}
