import { billMarkup } from './invoice-created.js';
import { icons } from '../src/icons.js';

export const name = 'scan-camera';

/* Measured against a render - see the note in screens/parties.js. */
export const targets = {
  'shutter': { x: 195, y: 786 },
  'flip': { x: 97, y: 786 }
};

/* The phone's own camera, not myBillBook's: the app hands over to it, which is
 * why this chrome is black and shares nothing with the app's palette.
 *
 * What it is pointed at is the bill the recipe is about, drawn by the same
 * markup the Sales Invoice Created screen uses. The reference frame shows the
 * owner's living room and his arm, and neither belongs in a published video -
 * a bill on a table is also what the shot is actually trying to say. */
const ZOOMS = ['.6', '1×', '2', '3', '5', '10'];

export function render(data, state) {
  /* Drifts a little across the shot so the frame reads as a hand holding a
   * phone rather than a still photograph. */
  const t = Number(state?.t ?? 0);
  const drift = Math.sin(t * 1.1) * 0.7;
  const tilt = -2.4 + Math.sin(t * 0.8) * 0.5;

  return `
<div class="screen camscreen">
  <div class="camtop">
    <span class="ico">${icons.close(17)}</span>
    <span class="camres">12M</span>
    <span class="ico">${icons.sliders(17)}</span>
  </div>

  <div class="camview">
    <div class="campaper" style="transform: translate(${drift.toFixed(2)}px, ${(-drift).toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(0.62)">
      ${billMarkup(data, { ...state, appear: 1 })}
    </div>
    <div class="camguide"><i></i><i></i><i></i><i></i></div>
    <div class="camhint">Hold steady over the bill</div>
  </div>

  <div class="cambottom">
    <div class="camzoom">
      ${ZOOMS.map((z, i) => `<span class="${i === 1 ? 'on' : ''}">${z}</span>`).join('')}
    </div>
    <div class="camrow">
      <span class="camflip" id="flip">${icons.camera(20)}</span>
      <span class="camshutter" id="shutter"></span>
      <span class="camflip" id="camgrid">${icons.scan(20)}</span>
    </div>
  </div>
</div>`;
}
