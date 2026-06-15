import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTerminalTheme } from '../terminalTheme.js';
import { GAMES, getGame } from './registry.jsx';
import Window, { TOPBAR_H } from './Window.jsx';
import Dock from './Dock.jsx';
import CommandLine from './CommandLine.jsx';
import ContextMenu from './ContextMenu.jsx';
import { AppTile } from './icons.jsx';

const useIsMobile = () => {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
};

const HomeClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="text-center mb-12">
      <div className="font-sans font-bold text-6xl text-gray-100 tracking-tight tabular-nums">{time}</div>
      <div className="font-mono text-sm text-gray-400 mt-2">{date}</div>
    </div>
  );
};

const HomeScreen = ({ onOpen }) => (
  <div className="fixed inset-0 flex flex-col px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)' }}>
    <HomeClock />
    {/* top-left app grid — fills left-to-right as more games are added */}
    <div className="flex flex-wrap gap-x-5 gap-y-6">
      {GAMES.map((g) => (
        <button key={g.id} onClick={() => onOpen(g.id)} className="w-16 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
          <AppTile size={60}><span className="block" style={{ width: 46, height: 46 }}><g.Icon /></span></AppTile>
          <span className="font-mono text-[11px] text-gray-300 leading-none w-full text-center truncate">{g.title}</span>
        </button>
      ))}
    </div>
  </div>
);

export default function Desktop() {
  useTerminalTheme();
  const isMobile = useIsMobile();
  const [windows, setWindows] = useState([]); // { id, x, y, z, minimized, fullscreen }
  const [focusedId, setFocusedId] = useState(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [ctx, setCtx] = useState(null);       // { x, y, items }
  const [, setTick] = useState(0);            // bump to recompute clamped window sizes on resize
  const zRef = useRef(10);
  const focusedRef = useRef(null);
  focusedRef.current = focusedId;

  // ── window-manager actions ────────────────────────────────────────────────
  const topMost = (ws) => {
    const vis = ws.filter((w) => !w.minimized);
    return vis.length ? vis.reduce((a, b) => (a.z > b.z ? a : b)).id : null;
  };

  // One game window at a time: opening a game replaces any other open game.
  const openGame = useCallback((id) => {
    if (!getGame(id)) return;
    setWindows((ws) => {
      const z = ++zRef.current;
      const existing = ws.find((w) => w.id === id);
      if (existing) return [{ ...existing, minimized: false, z }]; // restore/focus the same game
      const g = getGame(id);
      const w = Math.min(g.width, window.innerWidth - 16);
      const h = Math.min(g.height, window.innerHeight - TOPBAR_H - 16);
      const x = Math.max(0, (window.innerWidth - w) / 2);
      const y = Math.max(TOPBAR_H + 12, (window.innerHeight - h) / 2 - 16);
      return [{ id, x, y, z, minimized: false, fullscreen: false }]; // closes the previous game
    });
    setFocusedId(id);
    setTerminalOpen(false);
  }, []);

  const focusGame = useCallback((id) => {
    setFocusedId(id);
    setWindows((ws) => {
      const cur = ws.find((w) => w.id === id);
      const maxZ = ws.reduce((m, w) => Math.max(m, w.z), 0);
      if (cur && cur.z === maxZ && !cur.minimized) return ws;
      const z = ++zRef.current;
      return ws.map((w) => (w.id === id ? { ...w, z, minimized: false } : w));
    });
  }, []);

  const closeGame = useCallback((id) => {
    setTerminalOpen(false);
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const minimizeGame = useCallback((id) => {
    setTerminalOpen(false);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  // Keep focus pointing at a real, visible window (re-derives after close/minimize).
  useEffect(() => {
    setFocusedId((f) => (f && windows.some((w) => w.id === f && !w.minimized) ? f : topMost(windows)));
  }, [windows]);

  // Re-center windows when the browser resizes so they stay centered & on screen.
  useEffect(() => {
    const onResize = () => {
      setTick((t) => t + 1); // recompute the Math.min(width/height) in render
      setWindows((ws) => {
        if (!ws.length) return ws;
        return ws.map((w) => {
          if (w.fullscreen) return w;
          const g = getGame(w.id);
          const width = Math.min(g.width, window.innerWidth - 16);
          const height = Math.min(g.height, window.innerHeight - TOPBAR_H - 16);
          const x = Math.max(0, (window.innerWidth - width) / 2);
          const y = Math.max(TOPBAR_H + 12, (window.innerHeight - height) / 2 - 16);
          return (x === w.x && y === w.y) ? w : { ...w, x, y };
        });
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleFullscreen = useCallback((id) => {
    setFocusedId(id);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, fullscreen: !w.fullscreen, z: ++zRef.current } : w)));
  }, []);

  const moveGame = useCallback((id, x, y) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  // relaunch = unmount then mount fresh (resets the game)
  const relaunchGame = useCallback((id) => {
    closeGame(id);
    setTimeout(() => openGame(id), 0);
  }, [closeGame, openGame]);

  // terminal "switch" = replace: open the target (openGame already closes the current)
  const runSwitch = useCallback((targetId) => {
    setTerminalOpen(false);
    if (focusedRef.current === targetId) relaunchGame(targetId);
    else openGame(targetId);
  }, [openGame, relaunchGame]);

  // ── `/` opens the in-game command terminal (desktop only) ─────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (isMobile || terminalOpen || !focusedId) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === '/') { e.preventDefault(); setTerminalOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, terminalOpen, focusedId]);

  // ── hash routing: deep-link a game; reflect the focused game in the hash ───
  useEffect(() => {
    const apply = () => {
      const id = window.location.hash.replace(/^#\/?/, '');
      if (id && getGame(id)) openGame(id);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [openGame]);

  useEffect(() => {
    const want = focusedId ? `#/${focusedId}` : '#/';
    if (window.location.hash !== want) history.replaceState(null, '', want);
  }, [focusedId]);

  // ── render ────────────────────────────────────────────────────────────────
  const shown = isMobile ? windows.filter((w) => w.id === focusedId) : windows;
  const hasVisibleWindow = windows.some((w) => !w.minimized);

  const dockContext = (e, id) => {
    const isOpen = windows.some((w) => w.id === id);
    const title = getGame(id).title;
    setCtx({
      x: e.clientX, y: e.clientY,
      items: [
        { label: isOpen ? `Show ${title}` : `Open ${title}`, onClick: () => openGame(id) },
        { label: 'New Game', onClick: () => relaunchGame(id) },
        ...(isOpen ? [{ separator: true }, { label: `Quit ${title}`, onClick: () => closeGame(id) }] : []),
      ],
    });
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {shown.map((w) => {
        const g = getGame(w.id);
        const focused = w.id === focusedId;
        const active = focused && !w.minimized && !terminalOpen;
        return (
          <Window
            key={w.id}
            win={w}
            title={g.title}
            width={Math.min(g.width, (typeof window !== 'undefined' ? window.innerWidth : g.width) - 16)}
            height={Math.min(g.height, (typeof window !== 'undefined' ? window.innerHeight : g.height) - TOPBAR_H - 16)}
            isMobile={isMobile}
            focused={focused}
            onFocus={() => focusGame(w.id)}
            onClose={() => closeGame(w.id)}
            onMinimize={() => minimizeGame(w.id)}
            onToggleFullscreen={() => toggleFullscreen(w.id)}
            onMoveCommit={(x, y) => moveGame(w.id, x, y)}
            footer={focused && terminalOpen ? (
              <CommandLine currentId={focusedId} onRun={runSwitch} onClose={() => setTerminalOpen(false)} />
            ) : null}
          >
            <g.Component active={active} />
          </Window>
        );
      })}

      {isMobile
        ? (!focusedId && <HomeScreen onOpen={openGame} />)
        : <Dock autoHide={hasVisibleWindow} onOpen={openGame} onContext={dockContext} />}

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
    </div>
  );
}
