import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { sidebar } from './mbb-desktop-chrome.js';

export const name = 'mbb-desktop-report-list';

/* The Reports page: the directory of every report, which is what tapping
 * Reports in the rail actually opens.
 *
 * The studio had no screen for this. It had the Profit and Loss report and
 * nothing in front of it, so a script that said "Reports kholo aur profit
 * dekho" could only show the report, arriving from nowhere - the beat where
 * the owner sees how much the app already works out for them, missing.
 *
 * Built from the recording (Reports MBB Desktop). The groups, their order and
 * the report names inside them are the app's own, read off the page: the
 * Favourite column the owner has starred, then GST, Transaction, Item and
 * Party. Every one of these is a real myBillBook report; none is invented,
 * because a made-up report name in a creator's video is a feature the viewer
 * will go looking for and not find.
 *
 * Drawn light, like every other laptop screen here. The recording is in the
 * app's dark skin - see the note in mbb-desktop-reports.js.
 */
export const device = 'desktop';
export const url = 'mybillbook.in/app/reports/dashboard';

/* Where the camera rests: the Favourite column and the head of the GST one,
 * which is the half of the page a script ever points at. */
export const focus = { x: 300, y: 200 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  'create-sales-invoice': { x: 63, y: 45 },
  'ca-sharing': { x: 651, y: 22 },
  'open-balance-sheet': { x: 179, y: 108 },
  'open-profit-loss': { x: 195, y: 146 },
  'open-low-stock': { x: 191, y: 334 }
};

/* The filter chips across the top. */
const FILTERS = ['Party', 'Category', 'Payment Collection', 'Item', 'Invoice Details', 'Summary'];

/* Each group is [heading, icon, reports]. A report is a name, or a name with
 * an id to tap and a tag to print beside it. */
const GROUPS = [
  ['Favourite', 'star', [
    ['Balance Sheet', 'open-balance-sheet'],
    ['GSTR-1 (Sales)'],
    ['Profit And Loss Report', 'open-profit-loss'],
    ['Sales Summary - Staff Wise']
  ], 'starred'],
  ['GST', 'docSettings', [
    ['GSTR-2 (Purchase)'], ['GSTR-3b'], ['GST Purchase (With HSN)'],
    ['GST Sales (With HSN)'], ['HSN Wise Sales Summary'], ['TDS Payable'],
    ['TDS Receivable'], ['TCS Payable'], ['TCS Receivable']
  ]],
  ['Transaction', 'ledger', [
    ['Bill Wise Profit'], ['Cash and Bank Report (All Payments)'],
    ['Daybook - Staff Wise'], ['Expense Category Report'],
    ['Expense Transaction Report'], ['Purchase Summary']
  ]],
  ['Item', 'navItems', [
    ['Item Batch Report'], ['Item Report By Party'],
    ['IMEI/Serial No Report', null, 'New'], ['Item Sales and Purchase Summary'],
    ['Low Stock Summary', 'open-low-stock']
  ]],
  ['Party', 'mcfParties', [
    ['Receivable Ageing Report'], ['Party Report By Item'],
    ['Party Statement (Ledger)'], ['Party Wise Outstanding'],
    ['Sales Summary - Category Wise']
  ]]
];

/* How many a group shows before "See more". The real page opens collapsed and
 * the recording's owner had expanded two of them; collapsed is both the
 * default and the only state where all five groups fit on camera at once. */
const SHOWN = 5;

export function render(data, state) {
  /* The id goes on the NAME, not on the row. A row is the full width of its
   * column and most of that width is empty, so a ring drawn at the middle of
   * one would land in the gap to the right of the report it is opening. */
  const report = ([label, id, tag], starred) => `
    <div class="rl-row">
      <span class="rl-nm"${id ? ` id="${id}"` : ''}>${esc(label)}</span>
      ${tag ? `<span class="mb-new">${esc(tag)}</span>` : ''}
      ${starred ? `<span class="ico rl-star">${icons.star(9)}</span>` : ''}
    </div>`;

  const group = ([heading, icon, reports, starred]) => `
    <div class="rl-col">
      <div class="rl-head"><span class="ico">${icons[icon](9)}</span>${esc(heading)}</div>
      ${reports.slice(0, SHOWN).map(r => report(r, starred === 'starred')).join('')}
      ${reports.length > SHOWN ? `
      <div class="rl-less">See more <span class="ico">${icons.chevDown(8)}</span></div>` : ''}
    </div>`;

  return `
<div class="screen mbscreen">
  ${sidebar(data?.business?.name, 'Reports', null)}

  <div class="mb-main">
    <div class="mb-top">
      <div class="mb-title sm">Reports</div>
      <div class="mb-actions">
        <div class="mb-abtn primary" id="ca-sharing">
          <span class="ico">${icons.ledger(10)}</span>CA Reports Sharing
        </div>
      </div>
    </div>

    <div class="rl-filters">
      <span class="rl-filter-k">Filter By</span>
      ${FILTERS.map(f => `<span class="rl-chip">${esc(f)}</span>`).join('')}
    </div>

    <div class="rl-grid">
      ${GROUPS.map(group).join('')}
    </div>

    <div class="rl-find">Find Report <span class="rl-key">Ctrl</span> + <span class="rl-key">F</span></div>
  </div>
</div>`;
}
