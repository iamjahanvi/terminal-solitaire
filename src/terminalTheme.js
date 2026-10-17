import { useEffect } from 'react';

// Shared terminal-arcade look. Every game (Solitaire, Sudoku, ...) injects the
// same font + base CSS so the window chrome, wallpaper, scrollbars and the
// slide-up "zsh — exit 0/1" panel are identical. Game-specific classes
// (.striped-bg / .card-* for Solitaire, .sudoku-* for Sudoku) all live here too;
// they're harmless when the other game is mounted.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap';

const CSS = `
  html, body { height: 100%; }
  body { background-color: #0d0d0d; color: #e0e0e0; margin: 0; overflow: hidden; overscroll-behavior: none; -webkit-touch-callout: none; touch-action: manipulation; font-family: 'Fira Code', monospace; -webkit-tap-highlight-color: transparent; }
  /* wallpaper on its own fixed layer so it can be transformed independently of content */
  body::before { content: ''; position: fixed; inset: 0; z-index: -1; background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('/wallpaper.png') center / cover no-repeat; }
  @media (max-width: 639px) { body::before { transform: scaleY(-1); } } /* mobile: flip the background vertically */
  .terminal-bg { background-color: #1e1e1e; }
  .striped-bg { background: repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(150, 150, 150, 0.16) 4px, rgba(150, 150, 150, 0.16) 5px); }
  .card-label { background: linear-gradient(to bottom, rgba(30,30,30,0) 0%, #1e1e1e 28%, #1e1e1e 72%, rgba(30,30,30,0) 100%); }
  * { user-select: none; -webkit-user-select: none; }
  ::selection { background: transparent; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
  .card-cursor { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 2px; height: 18px; background: #00ff66; animation: blink 1s step-end infinite; }
  .prompt-cursor { display: inline-block; width: 2px; height: 1.05em; margin-left: 4px; background: #00ff66; vertical-align: text-bottom; animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .terminal-panel { animation: slideUp 0.18s ease-out; }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .panel-exit { animation: slideDown 0.24s ease-in forwards; }
  @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
  /* Sudoku */
  .sudoku-caret { display: inline-block; width: 2px; border-radius: 1px; background: #00ff66; animation: blink 1s step-end infinite; }
  /* Desktop / window manager */
  @keyframes winOpen { from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .win-open { animation: winOpen 0.14s ease-out; }
  .traffic-light { transition: filter 0.12s ease; }
  .traffic-light:hover { filter: brightness(0.8); }
  /* Dock — pure-CSS mac magnification (width/height grows, neighbors get pushed) */
  .dock { display: flex; align-items: flex-end; gap: 6px; height: 74px; box-sizing: border-box; padding: 12px 14px; border-radius: 22px; overflow: visible;
    background: rgba(255,255,255,0.4); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.65); }
  .dock .app { position: relative; flex: none; width: 50px; height: 50px; background: none; border: none; padding: 0; cursor: pointer;
    display: flex; align-items: flex-end; justify-content: center;
    transition: width .14s cubic-bezier(.25,1,.5,1), height .14s cubic-bezier(.25,1,.5,1); }
  .dock.dock-instant .app { transition: none; }
  .dock .app:hover { width: 82px; height: 82px; }
  .dock .app:hover + .app, .dock .app:has(+ .app:hover) { width: 66px; height: 66px; }
  .dock .app:hover + .app + .app, .dock .app:has(+ .app + .app:hover) { width: 56px; height: 56px; }
  .dock .app-tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 10px;
    background: rgba(20,20,20,0.92); border: 1px solid rgba(255,255,255,0.12); color: #f3f4f6; font-family: 'Fira Code', monospace;
    font-size: 11px; padding: 3px 8px; border-radius: 6px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .1s ease; }
  .dock .app:hover .app-tooltip { opacity: 1; }
  .dock .app-disabled { cursor: default; }
  .dock .app-soon { color: #9aa0a6; }
`;

let refCount = 0;
let fontEl = null;
let styleEl = null;

// Injected once and shared via a ref count, so mounting/unmounting a game (or
// React StrictMode's double-invoke) never duplicates or prematurely removes it.
export function useTerminalTheme() {
  useEffect(() => {
    refCount += 1;
    if (refCount === 1) {
      fontEl = document.createElement('link');
      fontEl.rel = 'stylesheet';
      fontEl.href = FONT_HREF;
      document.head.appendChild(fontEl);

      styleEl = document.createElement('style');
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
    return () => {
      refCount -= 1;
      if (refCount === 0) {
        if (fontEl) { document.head.removeChild(fontEl); fontEl = null; }
        if (styleEl) { document.head.removeChild(styleEl); styleEl = null; }
      }
    };
  }, []);
}
