'use client';

/* The offscreen stage. Mirrors stage/index.html so a browser render and a CLI
 * render produce the same frame. Positioned off-screen rather than hidden,
 * because display:none has no layout and would rasterise blank. */

import { forwardRef } from 'react';
import { asset } from '../../lib/base-path';

export const STAGE_W = 1080;
export const STAGE_H = 1920;

export const Stage = forwardRef<HTMLDivElement>(function Stage(_props, ref) {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: -99999,
        top: 0,
        width: STAGE_W,
        height: STAGE_H,
        pointerEvents: 'none'
      }}
    >
      <div
        ref={ref}
        id="stage-frame"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          position: 'relative',
          background: 'var(--mbb-brand-slate)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="logo-band">
          <img src={asset("/kit/brand/mybillbook-logo-reverse.png")} alt="myBillBook" />
        </div>
        <div className="stage-area">
          {/* Both frames exist; the painter shows whichever the screen needs.
              This has to match stage/index.html exactly - the command line
              draws from that one and the browser from this, and the two
              renders are compared frame by frame. */}
          <div className="stage-phone">
            <div id="stage-viewport" />
          </div>
          <div className="stage-desktop hidden" id="stage-desktop">
            <div className="stage-desktop-bar">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <div id="stage-desktop-url" />
            </div>
            <div id="stage-desktop-viewport" />
          </div>
        </div>
        <div id="stage-endcard-root" />
      </div>
    </div>
  );
});
