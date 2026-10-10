import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { invoiceFileName } from '../src/invoice.js';
import { statusBar, navBar, contactName, FILE_META } from './wa-chrome.js';

export const name = 'wa-attach';

/* The attachment preview, laid out from reference/frames/wa-21.5.png.
 * Coordinates are in 390x844 space, MEASURED from a render. */
export const targets = {
  caption: { x: 195, y: 676 },
  send: { x: 353, y: 738 }
};

export function render(data, state) {
  const file = invoiceFileName(data);
  const typed = state?.typed ?? '';

  return `
<div class="screen wa wa-attach">
  ${statusBar()}
  <div class="wa-head">
    <span class="ico">${icons.back(22)}</span>
    <div class="ttl one">${esc(file)}</div>
  </div>
  <div class="wa-doc">
    ${icons.pdfFile(46)}
    <div class="fn">${esc(file)}</div>
    <div class="fm">${FILE_META}</div>
  </div>
  <div class="wa-cap" id="caption">${typed ? `<span>${esc(typed)}</span><span class="caret"></span>` : '<span class="ph">Add a caption...</span>'}</div>
  <div class="wa-to"><span class="who">${esc(contactName(data))}</span><div class="wa-fab" id="send">${icons.send(22)}</div></div>
  ${navBar()}
</div>`;
}
