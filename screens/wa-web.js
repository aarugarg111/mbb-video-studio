import { esc } from '../src/esc.js';
import { icons } from '../src/icons.js';
import { formatINR, summarise } from '../src/money.js';
import { invoiceOf } from '../src/invoice.js';
import { contactName, initial } from './wa-chrome.js';

export const name = 'wa-web';

/* WhatsApp Web, with the bill's message written and waiting to be sent.
 *
 * This screen did not exist, and its absence was the whole of a fault that
 * took a long time to find. A laptop clip that shared a bill had nowhere to
 * go: the studio's only WhatsApp screens were the phone's, so a script ending
 * "show the WhatsApp chat with the invoice ready to share" either ended on a
 * phone in the middle of a desktop recording, or - because the studio warned
 * about doing that - ended nowhere at all, with the WhatsApp beat quietly
 * dropped. The payoff of a sharing video, missing, and every screen that DID
 * exist rendering perfectly.
 *
 * Built from a screen recording of the real thing (MBB Billing & Whatsapp).
 * What that shows, and what this draws:
 *
 *   - It is a BROWSER TAB, web.whatsapp.com, on the same laptop that made the
 *     bill. Sharing from the desktop app does not reach for a phone.
 *   - The message is ALREADY WRITTEN when the tab opens - myBillBook composes
 *     it - and the owner's last act is pressing Send. That is why `send` is
 *     the only thing here worth tapping.
 *   - What it sends is a LINK to the invoice, with a preview card above the
 *     message, not a PDF attachment. The phone attaches a PDF; the desktop
 *     sends a link. They are different flows and this is the desktop one.
 *
 * The chat list down the left is INVENTED, every row of it. The recording is
 * somebody's actual WhatsApp: real people, real businesses, real numbers,
 * none of which belongs in a public repository or in footage. Nothing here is
 * copied from it - not a name, not a number, not a message.
 */
export const device = 'desktop';
export const url = 'web.whatsapp.com';

/* Where the camera rests: the composed message and the Send button beside it,
 * which is the half of this screen the clip is about. */
export const focus = { x: 470, y: 300 };

/* Coordinates are in the desktop's 720x405 space and are MEASURED. */
export const targets = {
  send: { x: 697, y: 387 },
  attach: { x: 275, y: 391 }
};

/* Pressing Send posts the message: the composer empties and the bubble lands
 * in the conversation. It is the beat the whole clip has been walking toward,
 * so it is worth having rather than ending on a message still unsent. */
export const tapEffects = {
  send: { sent: 1 }
};

/* Send is a button of the composer, and sending empties the composer it is
 * in. Without this the ring would be left over the wallpaper. */
export const dismisses = ['send'];

/* Other conversations, so the list looks like a working day rather than one
 * chat. Trades, not people: a shop's WhatsApp is mostly suppliers and
 * customers, and a business name says that without inventing a person. */
const OTHER_CHATS = [
  ['Verma Hardware Supply', 'Stock bhej diya hai'],
  ['Cement Depot', 'Rate list attached'],
  ['Site Office', 'Kal delivery chahiye'],
  ['Tiles Wholesale', 'Thank you'],
  ['Transport Bhandar', 'Truck lag gaya']
];

export function render(data, state) {
  const inv = invoiceOf(data ?? {});
  const sums = summarise(data?.items ?? []);
  const who = contactName(data);
  const shop = String(data?.business?.name ?? 'My Business');
  const sent = Number(state?.sent ?? 0) > 0;

  /* myBillBook's own wording, which is product copy rather than anything out
     of the recording's conversations. The figures are the recipe's. */
  const link = 'mybillbook.in/cpp/invoice';
  const body = `Hi Sir/Ma&#8217;am,
Your payment of ${formatINR(sums.total)} against invoice number: ${esc(String(inv.number))} is pending.

You can view invoice here: ${link}

Thank you,
${esc(shop)}`;

  const chat = ([nm, last], i) => `
    <div class="ww-row${i === 0 ? ' on' : ''}">
      <div class="ww-av ${['a', 'b', 'c'][i % 3]}">${initial(nm)}</div>
      <div class="ww-rowtx">
        <div class="ww-rownm">${esc(nm)}</div>
        <div class="ww-rowlast">${esc(last)}</div>
      </div>
    </div>`;

  return `
<div class="screen wwscreen">
  <div class="ww-rail">
    <span class="ico on">${icons.whatsapp(14)}</span>
    <span class="ico">${icons.rupeeCircle(13)}</span>
    <span class="ico">${icons.settings(13)}</span>
  </div>

  <div class="ww-list">
    <div class="ww-listhead">
      <div class="ww-ttl">WhatsApp</div>
      <span class="ico">${icons.more(13)}</span>
    </div>
    <div class="ww-search"><span class="ico">${icons.search(11)}</span>Search or start a new chat</div>
    <div class="ww-pills"><span class="pl on">All</span><span class="pl">Unread</span><span class="pl">Groups</span></div>
    ${chat([who, 'Invoice bheja hai'], 0)}
    ${OTHER_CHATS.map((c, i) => chat(c, i + 1)).join('')}
  </div>

  <div class="ww-chat">
    <div class="ww-chathead">
      <div class="ww-av sm a">${initial(who)}</div>
      <div class="ww-who"><div class="n">${esc(who)}</div><div class="s">online</div></div>
      <span class="ico">${icons.search(13)}</span>
      <span class="ico">${icons.more(13)}</span>
    </div>

    <div class="ww-wall">
      <div class="ww-day">Today</div>
      ${sent ? `
      <div class="ww-bubble">
        <div class="ww-card">
          <div class="ww-cardk">mybillbook.in</div>
          <div class="ww-cardl">${esc(link)}</div>
        </div>
        <div class="ww-msg">${body}</div>
        <div class="ww-stamp">11:59 <span class="ico tick">${icons.check(10)}</span></div>
      </div>` : ''}
    </div>

    ${sent ? `
    <div class="ww-compose">
      <span class="ico" id="attach">${icons.attach(14)}</span>
      <div class="ww-field empty">Type a message</div>
      <div class="ww-send" id="send"><span class="ico">${icons.send(14)}</span></div>
    </div>` : `
    <div class="ww-compose tall">
      <div class="ww-preview">
        <div class="ww-cardk">mybillbook.in</div>
        <div class="ww-cardl">${esc(link)}</div>
      </div>
      <div class="ww-composerow">
        <span class="ico" id="attach">${icons.attach(14)}</span>
        <div class="ww-field">${body}</div>
        <div class="ww-send" id="send"><span class="ico">${icons.send(14)}</span></div>
      </div>
    </div>`}
  </div>
</div>`;
}
