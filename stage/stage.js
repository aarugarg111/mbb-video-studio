import { SCREENS } from '../screens/index.js';
import { stateAt, totalDuration } from '../src/timeline.js';

const viewport = document.getElementById('viewport');
let recipe = null;

window.mount = function mount(r) {
  recipe = r;
  window.videoDuration = totalDuration(r);
};

window.setTime = function setTime(t) {
  if (!recipe) throw new Error('setTime called before mount');

  const frame = stateAt(recipe, t);
  const data = { business: recipe.business, party: recipe.party, items: recipe.items };

  const layers = [];

  /* The outgoing screen slides a short way left and sits underneath, the way
   * Android moves a screen you are navigating away from. */
  if (frame.outgoing) {
    const x = (-28 * frame.outgoing.progress).toFixed(2);
    layers.push(
      `<div class="layer" style="transform: translateX(${x}%); z-index: 10">` +
      SCREENS[frame.outgoing.screen].render(data, frame.screenState) +
      `</div>`
    );
  }

  const inX = frame.outgoing ? ((1 - frame.outgoing.progress) * 100).toFixed(2) : '0';
  const shadow = frame.outgoing ? '-14px 0 28px rgba(0,0,0,0.14)' : 'none';
  layers.push(
    `<div class="layer" style="transform: translateX(${inX}%); z-index: 20; box-shadow: ${shadow}">` +
    SCREENS[frame.screen].render(data, frame.screenState) +
    `</div>`
  );

  if (frame.ripple) {
    const { x, y, progress } = frame.ripple;
    const scale = (0.45 + 0.85 * (1 - Math.pow(1 - progress, 3))).toFixed(3);
    layers.push(
      `<div class="ripple" style="left: ${x - 42}px; top: ${y - 42}px; ` +
      `opacity: ${(1 - progress).toFixed(3)}; transform: scale(${scale})"></div>`
    );
  }

  viewport.innerHTML = layers.join('');
};

/* The renderer waits on this before the first screenshot. Without it the first
 * frames render in a fallback font and the video visibly shifts. */
window.stageReady = document.fonts.ready.then(() => true);
