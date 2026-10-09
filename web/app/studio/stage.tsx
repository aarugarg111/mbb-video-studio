'use client';

/* The offscreen stage. Mirrors stage/index.html so a browser render and a CLI
 * render produce the same frame. Positioned off-screen rather than hidden,
 * because display:none has no layout and would rasterise blank. */

import { forwardRef } from 'react';

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
          <img src="/kit/brand/mybillbook-logo-reverse.png" alt="myBillBook" />
        </div>
        <div className="stage-area">
          <div className="stage-phone">
            <div id="stage-viewport" />
          </div>
        </div>
        <div id="stage-endcard-root" />
      </div>
    </div>
  );
});
