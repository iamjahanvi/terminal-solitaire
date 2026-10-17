import React, { useState, useRef, useEffect } from 'react';
import { GAMES, COMING_SOON } from './registry.jsx';
import { AppTile } from './icons.jsx';

const REVEAL_ZONE = 80; // px from the bottom of the screen that re-shows the dock

// Magnification, macOS-style: each icon's size is a smooth function of its distance
// from the pointer (cosine falloff over RADIUS), measured against the icons' resting
// layout so growth never feeds back into the distances. Sizes ease toward their
// targets every frame, so entering, sweeping across and leaving all glide.
const BASE = 50;      // resting icon size (matches .dock .app)
const MAX = 82;       // size of the icon directly under the pointer
const GAP = 6;        // matches .dock gap
const RADIUS = 150;   // px either side of the pointer that magnification reaches
const EASE_MS = 70;   // time constant of the per-frame easing (lower = snappier)

const targetSize = (dist) =>
  dist >= RADIUS ? BASE : BASE + (MAX - BASE) * (Math.cos((Math.PI * dist) / RADIUS) + 1) / 2;

// When a game window is visible, `autoHide` slides the dock off-screen; moving the
// pointer near the bottom of the screen reveals it. Pinned/visible otherwise.
export default function Dock({ autoHide, onOpen, onContext }) {
  const [revealed, setRevealed] = useState(false);
  const overDock = useRef(false);
  const dockRef = useRef(null);
  const appRefs = useRef([]);
  const sizes = useRef([]);
  const pointer = useRef(null); // pointer x relative to the dock's center; null = not over the dock
  const frame = useRef(0);
  const lastT = useRef(0);

  const tick = (t) => {
    const dt = lastT.current ? Math.min(t - lastT.current, 64) : 16;
    lastT.current = t;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const k = reduce ? 1 : 1 - Math.exp(-dt / EASE_MS);
    const els = appRefs.current.filter(Boolean);
    const restWidth = els.length * BASE + (els.length - 1) * GAP;
    let settling = false;
    els.forEach((el, i) => {
      const restCenter = -restWidth / 2 + i * (BASE + GAP) + BASE / 2;
      const target = pointer.current == null ? BASE : targetSize(Math.abs(pointer.current - restCenter));
      const cur = sizes.current[i] ?? BASE;
      let next = cur + (target - cur) * k;
      if (Math.abs(target - next) < 0.05) next = target; else settling = true;
      if (next !== cur) { sizes.current[i] = next; el.style.width = el.style.height = `${next}px`; }
    });
    if (settling) frame.current = requestAnimationFrame(tick);
    else { frame.current = 0; lastT.current = 0; }
  };
  const animate = () => { if (!frame.current) frame.current = requestAnimationFrame(tick); };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onDockMove = (e) => {
    const r = dockRef.current.getBoundingClientRect(); // dock stays centered as it grows
    pointer.current = e.clientX - (r.left + r.width / 2);
    animate();
  };

  useEffect(() => {
    if (!autoHide) { setRevealed(false); return; }
    const onMove = (e) => {
      const nearBottom = e.clientY >= window.innerHeight - REVEAL_ZONE;
      setRevealed(nearBottom || overDock.current);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [autoHide]);

  const hidden = autoHide && !revealed;

  return (
    <div
      className="fixed left-0 right-0 bottom-3 flex justify-center z-[100000] pointer-events-none"
      style={{ transform: hidden ? 'translateY(160%)' : 'translateY(0)', transition: 'transform .26s cubic-bezier(.25,1,.5,1)' }}
    >
      <div
        ref={dockRef}
        className="dock pointer-events-auto"
        onMouseEnter={() => { overDock.current = true; setRevealed(true); }}
        onMouseMove={onDockMove}
        onMouseLeave={() => { overDock.current = false; pointer.current = null; animate(); }}
      >
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            ref={(el) => { appRefs.current[i] = el; }}
            className="app"
            onClick={() => onOpen(g.id)}
            onContextMenu={(e) => { e.preventDefault(); onContext(e, g.id); }}
          >
            <span className="app-tooltip">{g.title}</span>
            <AppTile>
              <span className="block" style={{ width: '74%', height: '74%' }}><g.Icon /></span>
            </AppTile>
          </button>
        ))}
        {COMING_SOON.map((g, i) => (
          <button key={g.id} ref={(el) => { appRefs.current[GAMES.length + i] = el; }} className="app app-disabled" aria-disabled="true" aria-label={`${g.title} (coming soon)`} onContextMenu={(e) => e.preventDefault()}>
            <span className="app-tooltip">{g.title} <span className="app-soon">· coming soon</span></span>
            <AppTile>
              <span className="block" style={{ width: '74%', height: '74%' }}><g.Icon /></span>
            </AppTile>
          </button>
        ))}
      </div>
    </div>
  );
}
