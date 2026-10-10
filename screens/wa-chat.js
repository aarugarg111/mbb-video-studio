import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { invoiceFileName } from '../src/invoice.js';
import { statusBar, navBar, contactName, initial, FILE_META } from './wa-chrome.js';

export const name = 'wa-chat';

/* The chat with the invoice delivered, laid out from reference/frames/
 * wa-23.5.png. The conversation is EMPTY apart from the one bubble: nothing of
 * the recording's history is reproduced. Coordinates are in 390x844 space,
 * MEASURED from a render. */
export const targets = {
  back: { x: 25, y: 65 },
  attachment: { x: 249, y: 293 }
};

export function render(data, state) {
  const file = invoiceFileName(data);
  const who = contactName(data);
  const appear = state?.appear ?? 1;

  return `
<div class="screen wa wa-chat">
  ${statusBar()}
  <div class="wa-head chat">
    <span class="ico" id="back">${icons.back(22)}</span>
    <div class="wa-av sm a">${initial(who)}</div>
    <div class="who"><div class="n">${esc(who)}</div><div class="s">online</div></div>
    <span class="ico">${icons.videoCall(24)}</span>
    <span class="ico">${icons.more(20)}</span>
  </div>
  <div class="wa-wall">
    <div class="wa-bubble out" id="attachment" style="opacity: ${Math.min(1, appear * 1.5).toFixed(3)}">
      <div class="wa-thumb">
        <div class="pg"><i class="h"></i><i></i><i></i><i class="s"></i><i></i><i class="s"></i><i></i></div>
      </div>
      <div class="wa-filecard">
        ${icons.pdfFile(30)}
        <div class="tx"><div class="fn">${esc(file)}</div><div class="fm">${FILE_META}</div></div>
      </div>
      <div class="meta"><span>11:59</span><span class="dt">${icons.doubleCheck(16)}</span></div>
    </div>
  </div>
  <div class="wa-input">
    <div class="box">
      <span class="ico">${icons.sticker(22)}</span>
      <span class="ph">Message</span>
      <span class="ico">${icons.attach(21)}</span>
      <span class="ico">${icons.rupeeCircle(21)}</span>
      <span class="ico">${icons.camera(21)}</span>
    </div>
    <div class="wa-fab">${icons.mic(22)}</div>
  </div>
  ${navBar()}
</div>`;
}
