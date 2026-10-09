import { SCREENS as UNTYPED_SCREENS } from '../../screens/index.js';
import { stateAt, totalDuration } from '../../src/timeline.js';
import { loadAssets } from './assets';
import { rasterise } from './rasterise';
import { createEncoder } from './encode';
import { STAGE_W, STAGE_H } from '../app/studio/stage';
const SCREENS = UNTYPED_SCREENS as Record<string, { render(data: unknown, state: unknown): string }>;

type Options = { fps?: number; onProgress?: (done: number, total: number) => void };

function escapeHtml(text: string) {
  return String(text).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[c]);
}

/* Draws one instant into the offscreen stage. The same shape as
 * stage/stage.js, deliberately - two implementations of the layering would
 * drift and the browser and CLI renders would stop matching. */
function paint(frame: any, recipe: any, viewport: HTMLElement, endcardRoot: HTMLElement) {
  const data = {
    business: recipe.business,
    party: recipe.party,
    items: recipe.items,
    invoice: recipe.invoice
  };

  const layers: string[] = [];

  if (frame.outgoing) {
    const x = (-28 * frame.outgoing.progress).toFixed(2);
    layers.push(
      `<div class="layer" style="transform: translateX(${x}%); z-index: 10">` +
      SCREENS[frame.outgoing.screen].render(data, frame.screenState) +
      `</div>`
    );
  }

  const inX = frame.outgoing ? ((1 - frame.outgoing.progress) * 100).toFixed(2) : '0';
  const shadow = frame.outgoing ? '-14px 0 28px var(--mbb-transition-shadow)' : 'none';
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

  endcardRoot.innerHTML = frame.endCard
    ? `<div class="endcard" style="opacity: ${frame.endCard.progress.toFixed(3)}">` +
      `<img src="/kit/brand/mybillbook-logo-reverse.png" alt="myBillBook">` +
      `<p class="endcard-tagline">${escapeHtml(recipe.brand.endCard.tagline)}</p></div>`
    : '';
}

export async function renderVideo(recipe: any, opts: Options = {}): Promise<Blob> {
  const fps = opts.fps ?? 30;
  const frames = Math.round(totalDuration(recipe) * fps);

  const stage = document.getElementById('stage-frame') as HTMLElement | null;
  const viewport = document.getElementById('stage-viewport') as HTMLElement | null;
  const endcardRoot = document.getElementById('stage-endcard-root') as HTMLElement | null;
  if (!stage || !viewport || !endcardRoot) throw new Error('The stage is not mounted.');

  const assets = await loadAssets();

  /* The SVG embeds the font, but the LAYOUT happens here in the page - so if
   * the page is still on a fallback face, every position is measured wrong
   * and the embedded font then paints into the wrong boxes.
   *
   * document.fonts.ready alone is not enough: it resolves immediately when
   * nothing has requested the font yet, which is the state the stage is in
   * before the first frame is painted. Ask for each weight explicitly, and
   * for the rupee sign, which lives in the latin-ext subset and is otherwise
   * fetched lazily on first use - mid-render. */
  await Promise.all(
    ['400', '500', '700'].flatMap(w => [
      document.fonts.load(`${w} 16px "DM Sans"`, 'A'),
      document.fonts.load(`${w} 16px "DM Sans"`, '₹')
    ])
  ).catch(() => { /* offline: fall back rather than hang the render */ });
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = STAGE_W;
  canvas.height = STAGE_H;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const encoder = await createEncoder({ width: STAGE_W, height: STAGE_H, fps });

  for (let i = 0; i < frames; i++) {
    paint(stateAt(recipe, i / fps), recipe, viewport, endcardRoot);

    const img = await rasterise(stage, assets, STAGE_W, STAGE_H);
    ctx.drawImage(img, 0, 0);
    await encoder.addFrame(canvas, i);

    opts.onProgress?.(i + 1, frames);

    /* Yield every so often so the progress bar actually paints. */
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }

  return encoder.finish();
}
