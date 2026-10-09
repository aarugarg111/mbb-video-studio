/* The stage's own layout rules. The rasterised SVG is a separate document
 * that sees only the CSS handed to it, and globals.css is not part of that -
 * without these the phone has no size or position and the frame is just the
 * logo on a blank background. Mirrors stage/index.html. */
export const STAGE_CSS = `
.stage-area { flex: 1; display: flex; align-items: center; justify-content: center; }
.stage-phone { padding: 11px; background: var(--stage-phone-body); border-radius: 46px; transform: scale(1.8); }
#stage-viewport { position: relative; width: 390px; height: 844px; border-radius: 36px; overflow: hidden; background: var(--mbb-tint-100); }
#stage-viewport .layer { position: absolute; inset: 0; }
`;
