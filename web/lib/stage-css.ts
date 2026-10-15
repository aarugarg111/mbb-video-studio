/* The stage's own layout rules. The rasterised SVG is a separate document
 * that sees only the CSS handed to it, and globals.css is not part of that -
 * without these the phone has no size or position and the frame is just the
 * logo on a blank background. Mirrors stage/index.html. */
export const STAGE_CSS = `
.stage-area { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.stage-phone { padding: 11px; background: var(--stage-phone-body); border-radius: 46px; transform: scale(1.8); }
#stage-viewport { position: relative; width: 390px; height: 844px; border-radius: 36px; overflow: hidden; background: var(--mbb-tint-100); }
#stage-viewport .layer { position: absolute; inset: 0; }
.camera { position: absolute; inset: 0; }

/* The desktop frame. Without these the browser render drew an empty phone
   while the command line drew a laptop - the same recipe, two different
   videos, and nothing failed. */
.stage-desktop { background: var(--stage-phone-body); border-radius: 14px; padding: 0 0 8px; transform: scale(1.5); }
.stage-desktop.hidden, .stage-phone.hidden { display: none; }
.stage-desktop-bar { height: 30px; display: flex; align-items: center; gap: 8px; padding: 0 12px; }
.stage-desktop-bar .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--stage-window-dot); }
#stage-desktop-url { flex: 1; margin-left: 6px; height: 17px; border-radius: 999px; background: var(--stage-window-url); color: var(--stage-window-urltext); font: 400 9px/17px var(--mbb-font); text-align: center; overflow: hidden; white-space: nowrap; }
/* Tally is a program, not a web page: its window has a title bar and no
     address. Same frame otherwise - it is the same machine. */
  #stage-desktop-bar.app { background: var(--stage-window-title); }
  #stage-desktop-bar.app .dot { background: var(--stage-window-dot); }
  #stage-desktop-url.app {
    flex: 1;
    margin-left: 6px;
    height: 17px;
    border-radius: 0;
    background: none;
    color: var(--stage-window-titletext);
    font: 600 9px/17px var(--mbb-font);
    text-align: left;
  }
#stage-desktop-viewport { position: relative; width: 720px; height: 405px; margin: 0 8px; border-radius: 6px; overflow: hidden; background: var(--mbb-tint-100); }
#stage-desktop-viewport .layer { position: absolute; inset: 0; }
`;
