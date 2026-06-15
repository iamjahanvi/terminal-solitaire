import React, { useState, useRef, useEffect } from 'react';
import { GAMES, getGame } from './registry.jsx';

// Slides up from the focused window's bottom (reusing the win-panel style). Type
// /solitaire or /sudoku; the first match shows as a ghost suggestion (TAB to
// complete), ENTER runs it (replace = close current, open target), ESC closes.
const COMMANDS = GAMES.map((g) => `/${g.id}`);

export default function CommandLine({ currentId, onRun, onClose }) {
  const [value, setValue] = useState('/');
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current && inputRef.current.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, []);

  // Slide back down (matching the open animation) before actually unmounting.
  const animatedClose = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onClose, 220);
  };

  // first command that starts with what's typed (but isn't already complete)
  const suggestion = COMMANDS.find((c) => c.startsWith(value) && c !== value) || '';
  const ghost = suggestion ? suggestion.slice(value.length) : '';

  const run = () => {
    const cmd = value.trim();
    const g = GAMES.find((x) => `/${x.id}` === cmd);
    if (g) { onRun(g.id); return; } // switch replaces the window — no exit anim needed
    animatedClose(); // unknown command — just dismiss
  };

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); animatedClose(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(); }
    else if (e.key === 'Tab') { e.preventDefault(); if (suggestion) setValue(suggestion); }
  };

  return (
    <div
      className={`terminal-panel ${exiting ? 'panel-exit' : ''} absolute bottom-0 left-0 right-0 z-[55] bg-[#181818] border-t border-[#2d2d2d] font-mono text-xs`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-4 px-4 h-7 border-b border-gray-800 text-[11px] uppercase tracking-wider">
        <span className="text-gray-200">Terminal</span>
        <span className="ml-auto normal-case text-gray-600">zsh — arcade</span>
      </div>
      <div className="px-4 py-3">
        {/* Inline display (always aligned) with a transparent input over it for capture. */}
        <div className="relative flex items-center">
          <span className="text-[#00ff66] whitespace-pre">user@arcade</span>
          <span className="text-gray-500 whitespace-pre">:~$ </span>
          <span className="text-gray-100 whitespace-pre">{value}</span>
          <span className="prompt-cursor" style={{ marginLeft: 0 }} />
          <span className="text-gray-600 whitespace-pre">{ghost}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="absolute inset-0 w-full h-full opacity-0 bg-transparent outline-none border-none cursor-text"
          />
        </div>
        <p className="text-gray-600 mt-2 normal-case">
          available: {COMMANDS.map((c, i) => (
            <span key={c}>
              <span className={`/${currentId}` === c ? 'text-gray-700' : 'text-gray-500'}>{c}</span>
              {i < COMMANDS.length - 1 ? ' ' : ''}
            </span>
          ))} · <span className="text-gray-500">TAB</span> complete · <span className="text-gray-500">ENTER</span> run · <span className="text-gray-500">ESC</span> close
        </p>
      </div>
    </div>
  );
}
