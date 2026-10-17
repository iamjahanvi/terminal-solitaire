import React, { useState, useRef, useEffect } from 'react';
import { GAMES, COMING_SOON } from './registry.jsx';
import { AppTile } from './icons.jsx';

const REVEAL_ZONE = 80; // px from the bottom of the screen that re-shows the dock

// Pure-CSS mac dock magnification (see .dock rules in terminalTheme). When a game
// window is visible, `autoHide` slides the dock off-screen; moving the pointer
// near the bottom of the screen reveals it. Pinned/visible otherwise.
export default function Dock({ autoHide, onOpen, onContext }) {
  const [revealed, setRevealed] = useState(false);
  const overDock = useRef(false);

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
        className={`dock pointer-events-auto ${hidden ? 'dock-instant' : ''}`}
        onMouseEnter={() => { overDock.current = true; setRevealed(true); }}
        onMouseLeave={() => { overDock.current = false; }}
      >
        {GAMES.map((g) => (
          <button
            key={g.id}
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
        {COMING_SOON.map((g) => (
          <button key={g.id} className="app app-disabled" aria-disabled="true" aria-label={`${g.title} (coming soon)`} onContextMenu={(e) => e.preventDefault()}>
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
