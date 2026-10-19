import React, { useState, useEffect, useCallback, useRef } from 'react';
import Matter from 'matter-js';
import { WindowControls } from './src/desktop/Window.jsx';
import { recordWin } from './src/desktop/stats.js';

// ─────────────────────────────────────────────────────────────────────────────
// Engine — pure JS, no deps. A grid is a flat array of 81 ints (0 = empty),
// index = row*9 + col.
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTIES = {
  easy: { label: 'easy', givens: 40 },
  medium: { label: 'medium', givens: 32 },
  hard: { label: 'hard', givens: 26 },
};

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

// Can `val` legally sit at index `i` given the current grid?
const isSafe = (grid, i, val) => {
  const r = rowOf(i), c = colOf(i);
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    if (grid[r * 9 + k] === val) return false; // row
    if (grid[k * 9 + c] === val) return false; // column
    const bi = (br + Math.floor(k / 3)) * 9 + (bc + (k % 3));
    if (grid[bi] === val) return false;        // 3×3 box
  }
  return true;
};

// Fill an empty grid with a random complete valid solution (backtracking).
const generateSolved = () => {
  const grid = new Array(81).fill(0);
  const fill = (pos) => {
    if (pos === 81) return true;
    if (grid[pos] !== 0) return fill(pos + 1);
    for (const val of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (isSafe(grid, pos, val)) {
        grid[pos] = val;
        if (fill(pos + 1)) return true;
        grid[pos] = 0;
      }
    }
    return false;
  };
  fill(0);
  return grid;
};

// Count solutions, bailing out as soon as we exceed `limit` (we only ever need
// to know "exactly one" vs "more than one"). Uses MRV (fewest-candidates-first)
// so near-complete grids resolve quickly.
const countSolutions = (grid, limit = 2) => {
  let count = 0;
  const solve = () => {
    let best = -1, bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const cands = [];
      for (let v = 1; v <= 9; v++) if (isSafe(grid, i, v)) cands.push(v);
      if (cands.length === 0) return;            // dead end
      if (bestCands === null || cands.length < bestCands.length) {
        best = i; bestCands = cands;
        if (cands.length === 1) break;           // can't do better
      }
    }
    if (best === -1) { count++; return; }        // no empty cell ⇒ a solution
    for (const v of bestCands) {
      grid[best] = v;
      solve();
      grid[best] = 0;
      if (count >= limit) return;
    }
  };
  solve();
  return count;
};

// Carve a puzzle out of a full solution by clearing cells while the solution
// stays unique, until we hit the target number of givens (or can't remove more).
const makePuzzle = (solution, targetGivens) => {
  const puzzle = solution.slice();
  let givens = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (givens <= targetGivens) break;
    const backup = puzzle[i];
    puzzle[i] = 0;
    const trial = puzzle.slice();
    if (countSolutions(trial, 2) !== 1) {
      puzzle[i] = backup; // removing this clue made it ambiguous — keep it
    } else {
      givens--;
    }
  }
  return puzzle;
};

const newGame = (difficulty) => {
  const solution = generateSolved();
  const puzzle = makePuzzle(solution, DIFFICULTIES[difficulty].givens);
  const cells = puzzle.map((v) => ({ value: v, given: v !== 0, locked: false }));
  return { solution, cells };
};

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────

export const SudokuGame = ({ active = true }) => {
  const [difficulty, setDifficulty] = useState('easy');
  const [solution, setSolution] = useState([]);
  const [cells, setCells] = useState([]);            // [{ value, given, locked }]
  const [selected, setSelected] = useState(null);    // 0..80 or null
  const [mistakes, setMistakes] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('playing');   // 'playing' | 'won'
  const [panelExiting, setPanelExiting] = useState(false);

  // Layout: board cells scale to fit; the window frame is owned by the desktop.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  const [board, setBoard] = useState({ w: 480, h: 480 });

  const boardAreaRef = useRef(null);
  const winPanelRef = useRef(null);
  const physCanvasRef = useRef(null); // win: zero-g floating-numbers physics box
  const gameRef = useRef(null);      // fresh state for window key listeners
  const activeRef = useRef(active);  // only the focused window responds to the keyboard
  activeRef.current = active;
  const panelExitingRef = useRef(false); // win-panel sliding away → drop the spilled numbers
  panelExitingRef.current = panelExiting;

  // A square grid that fits the available board area (both width and height).
  const MAX_CELL = isMobile ? 46 : 56;
  const cell = Math.max(28, Math.min(MAX_CELL, Math.floor(Math.min(board.w, board.h) / 9)));
  const gridPx = cell * 9;

  const startNewGame = useCallback((diff = difficulty) => {
    const { solution: sol, cells: c } = newGame(diff);
    setSolution(sol);
    setCells(c);
    setSelected(40); // center cell — so the keyboard (arrows) works immediately
    setMistakes(0);
    setHintsLeft(3);
    setSeconds(0);
    setStatus('playing');
    requestAnimationFrame(() => boardAreaRef.current && boardAreaRef.current.focus({ preventScroll: true }));
  }, [difficulty]);

  const chooseDifficulty = useCallback((diff) => {
    setDifficulty(diff);
    startNewGame(diff);
  }, [startNewGame]);

  const dismissPanel = useCallback(() => {
    setPanelExiting((exiting) => {
      if (exiting) return exiting;
      setTimeout(() => { startNewGame(); setPanelExiting(false); }, 240);
      return true;
    });
  }, [startNewGame]);

  useEffect(() => { startNewGame(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track layout mode.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onW = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onW);
    return () => mq.removeEventListener('change', onW);
  }, []);

  // Measure the board area so the grid stays a square that fits.
  useEffect(() => {
    const el = boardAreaRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setBoard({ w: el.clientWidth, h: el.clientHeight }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [isMobile]);

  // Timer — runs while playing.
  useEffect(() => {
    if (status !== 'playing' || cells.length === 0) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status, cells.length]);

  // Remember the win so the desktop cat can mention streaks and best times.
  useEffect(() => {
    if (status === 'won') recordWin('sudoku', { seconds, difficulty });
  }, [status]);

  // Win celebration (Matter.js rigid bodies): the grid vanishes and the 81 solved
  // digits drop as circles, collide, and pile up on the terminal panel — the engine's
  // sleeping keeps the settled pile dead-still. Desktop: the mouse shoves the pile.
  // Mobile: device tilt steers gravity (auto; falls back to straight-down).
  useEffect(() => {
    if (status !== 'won') return;
    const canvas = physCanvasRef.current;
    if (!canvas) return;
    const { Engine, Bodies, Composite, Body, Sleeping } = Matter;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const panelH = winPanelRef.current ? winPanelRef.current.offsetHeight : 64;
    const floorY = H - panelH;            // numbers rest on the terminal panel's top edge
    const gridLeft = (W - gridPx) / 2;
    const gridTop = (H - gridPx) / 2 - cell * 0.7; // ~ where the grid sat during play
    const R = cell * 0.22;                // body radius ≈ the digit (snug pile)

    const engine = Engine.create();
    engine.enableSleeping = true;
    engine.gravity.y = 1;

    const Tk = 240; // wall thickness
    const floorBody = Bodies.rectangle(W / 2, floorY + Tk / 2, W * 3, Tk, { isStatic: true });
    Composite.add(engine.world, [
      floorBody,
      Bodies.rectangle(W / 2, -Tk / 2, W * 3, Tk, { isStatic: true }),       // ceiling (so tilting upside-down keeps them in)
      Bodies.rectangle(-Tk / 2, H / 2, Tk, H * 4, { isStatic: true }),       // left wall
      Bodies.rectangle(W + Tk / 2, H / 2, Tk, H * 4, { isStatic: true }),    // right wall
    ]);

    const bodies = [];
    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      const body = Bodies.circle(
        gridLeft + (colOf(i) + 0.5) * cell,
        gridTop + (rowOf(i) + 0.5) * cell,
        R,
        { restitution: 0.2, friction: 0.6, frictionStatic: 0.8, frictionAir: 0.012 }
      );
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
      body.digit = String(solution[i]);
      body.color = c.given ? '#f3f4f6' : c.locked ? '#2e9e57' : '#00ff66';
      bodies.push(body);
    }
    Composite.add(engine.world, bodies);

    // device tilt (mobile) → gravity direction; a notable tilt change wakes the pile.
    let pgx = 0, pgy = 1;
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const TILT = 1.5; // tilt sensitivity (1 = real gravity)
      const ngx = Math.max(-TILT, Math.min(TILT, (a.x || 0) / -9.8 * TILT));
      const ngy = Math.max(-TILT, Math.min(TILT, (a.y || 0) / 9.8 * TILT));
      if (Math.hypot(ngx - pgx, ngy - pgy) > 0.15) bodies.forEach((b) => Sleeping.set(b, false));
      pgx = ngx; pgy = ngy;
      engine.gravity.x = ngx; engine.gravity.y = ngy;
    };
    // Motion needs a secure context (HTTPS); iOS also needs a tap to grant permission.
    let askMotion = null;
    if (isMobile && typeof window.DeviceMotionEvent !== 'undefined') {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        askMotion = () => {
          DeviceMotionEvent.requestPermission().then((res) => { if (res === 'granted') window.addEventListener('devicemotion', onMotion); }).catch(() => {});
          canvas.removeEventListener('pointerdown', askMotion); askMotion = null;
        };
        canvas.addEventListener('pointerdown', askMotion); // first tap on the pile grants it
      } else {
        window.addEventListener('devicemotion', onMotion); // Android & others
      }
    }

    // mouse shove (desktop), only while actually moving.
    let mx = -1, my = -1, lastMoveT = -1;
    const INFL = cell * 1.7;
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; lastMoveT = performance.now(); };
    const onLeave = () => { mx = -1; my = -1; };
    if (!isMobile) { canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mouseleave', onLeave); }

    let raf, cancelled = false, dropping = false, fade = 1, floorGone = false;
    const loop = () => {
      if (cancelled) return;
      // panel closing → pull away their shelf so the pile falls, and fade the digits out
      if (panelExitingRef.current && !dropping) {
        dropping = true;
        if (!floorGone) { Composite.remove(engine.world, floorBody); floorGone = true; }
        bodies.forEach((b) => { Sleeping.set(b, false); Body.setVelocity(b, { x: b.velocity.x, y: b.velocity.y + 6 }); });
      }
      if (dropping) fade = Math.max(0, fade - 0.08);
      // mouse shove
      if (!isMobile && mx >= 0 && performance.now() - lastMoveT < 120) {
        for (const b of bodies) {
          const dx = b.position.x - mx, dy = b.position.y - my, d = Math.hypot(dx, dy) || 1;
          if (d < INFL) {
            const s = (1 - d / INFL) * 4;
            Sleeping.set(b, false);
            Body.setVelocity(b, { x: (dx / d) * s, y: (dy / d) * s });
          }
        }
      }
      Engine.update(engine, 1000 / 60);
      // draw the digits at each body's position & rotation
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `500 ${Math.round(cell * 0.5)}px "Fira Code", monospace`;
      for (const b of bodies) {
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = b.color;
        ctx.fillText(b.digit, 0, 1);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('devicemotion', onMotion);
      if (askMotion) canvas.removeEventListener('pointerdown', askMotion);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCellValue = useCallback((idx, val) => {
    if (status !== 'playing' || idx == null) return;
    const c = cells[idx];
    if (!c || c.given || c.locked) return;   // can't edit clues or hint-revealed cells
    if (c.value === val) return;             // no change

    const next = cells.slice();
    next[idx] = { ...c, value: val };
    setCells(next);

    if (val !== 0 && val !== solution[idx]) {
      // wrong placement — just shows red, but you can't lose (unlimited);
      // we still tally mistakes for the win summary.
      setMistakes((m) => m + 1);
      return;
    }

    // correct entry — check for a win (every cell now matches the solution)
    if (val !== 0 && next.every((cc, i) => cc.value === solution[i])) {
      setStatus('won');
    }
  }, [cells, solution, status]);

  const clearCell = useCallback((idx) => {
    if (status !== 'playing' || idx == null) return;
    const c = cells[idx];
    if (!c || c.given || c.locked || c.value === 0) return;
    const next = cells.slice();
    next[idx] = { ...c, value: 0 };
    setCells(next);
  }, [cells, status]);

  const useHint = useCallback(() => {
    if (status !== 'playing' || hintsLeft <= 0 || cells.length === 0) return;
    // target the selected empty cell, else a random empty/incorrect one
    let idx = selected;
    const editableWrong = (i) => !cells[i].given && !cells[i].locked && cells[i].value !== solution[i];
    if (idx == null || !editableWrong(idx)) {
      const candidates = [];
      for (let i = 0; i < 81; i++) if (editableWrong(i)) candidates.push(i);
      if (candidates.length === 0) return;
      idx = candidates[Math.floor(Math.random() * candidates.length)];
    }
    const next = cells.slice();
    next[idx] = { value: solution[idx], given: false, locked: true };
    setCells(next);
    setSelected(idx);
    setHintsLeft((h) => h - 1);
    if (next.every((cc, i) => cc.value === solution[i])) setStatus('won');
  }, [status, hintsLeft, cells, selected, solution]);

  gameRef.current = { status, setCellValue, clearCell, selected, setSelected, dismissPanel };

  // ENTER restarts after a win (works even if the board lost focus). All gameplay
  // keys (1-9, clear, arrows) are handled on the focusable board itself — far more
  // reliable than a window-level listener.
  useEffect(() => {
    const onKey = (e) => {
      if (!activeRef.current) return;
      const g = gameRef.current;
      if (g.status !== 'playing' && e.key === 'Enter') g.dismissPanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep keyboard focus on the board so arrows/digits always work.
  useEffect(() => {
    if (active) boardAreaRef.current && boardAreaRef.current.focus({ preventScroll: true });
  }, [active]);

  // Board key handler (board is focusable): 1-9 enter, 0/Backspace/Delete clear,
  // arrows move the selection, Enter restarts after a win.
  const handleBoardKey = (e) => {
    if (!active) return;
    if (status !== 'playing') { if (e.key === 'Enter') dismissPanel(); return; }
    if (e.key >= '1' && e.key <= '9') { e.preventDefault(); setCellValue(selected, parseInt(e.key, 10)); return; }
    if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clearCell(selected); return; }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const cur = selected == null ? 40 : selected;
      let r = rowOf(cur), c = colOf(cur);
      if (e.key === 'ArrowUp') r = (r + 8) % 9;
      else if (e.key === 'ArrowDown') r = (r + 1) % 9;
      else if (e.key === 'ArrowLeft') c = (c + 8) % 9;
      else if (e.key === 'ArrowRight') c = (c + 1) % 9;
      setSelected(r * 9 + c);
    }
  };

  // ── Derived highlight helpers ──────────────────────────────────────────────
  const selVal = selected != null && cells[selected] ? cells[selected].value : 0;
  const isPeer = (i) =>
    selected != null && i !== selected &&
    (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected));
  const isSameNumber = (i) => selVal !== 0 && cells[i] && cells[i].value === selVal;
  const isWrong = (i) => cells[i] && !cells[i].given && !cells[i].locked && cells[i].value !== 0 && cells[i].value !== solution[i];

  // remaining count per digit (greys out the pad button once all 9 are correctly placed)
  const remaining = (d) => {
    let placed = 0;
    for (let i = 0; i < 81; i++) if (cells[i] && cells[i].value === d && solution[i] === d) placed++;
    return 9 - placed;
  };

  const gameOver = status === 'won';

  // ── Cell rendering ─────────────────────────────────────────────────────────
  const cellColor = (c, i) => {
    if (c.value === 0) return 'transparent';
    if (c.given) return '#f3f4f6';                       // clue — bright neutral
    if (c.value !== solution[i]) return '#ff5555';       // wrong — red
    if (c.locked) return '#2e9e57';                      // hint-revealed — muted green
    return '#00ff66';                                    // your entry — terminal green
  };

  const renderGrid = () => (
    <div
      className="relative font-mono select-none"
      style={{ width: gridPx, height: gridPx }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(9, ${cell}px)`, gridTemplateRows: `repeat(9, ${cell}px)` }}>
        {cells.map((c, i) => {
          const r = rowOf(i), col = colOf(i);
          const sel = selected === i;
          const peer = isPeer(i);
          const same = !sel && isSameNumber(i);
          const wrong = isWrong(i);
          let bg = 'transparent';
          if (sel) bg = wrong ? 'rgba(255,85,85,0.18)' : 'rgba(255,255,255,0.14)';
          else if (same) bg = 'rgba(255,255,255,0.10)';
          else if (peer) bg = 'rgba(255,255,255,0.045)';
          return (
            <div
              key={i}
              onClick={() => setSelected(i)}
              className="flex items-center justify-center cursor-pointer"
              style={{
                width: cell, height: cell,
                background: bg,
                color: cellColor(c, i),
                fontSize: cell * 0.5,
                fontWeight: c.given ? 600 : 400,
                lineHeight: 1,
                borderTop: '1px solid rgba(255,255,255,0.10)',
                borderLeft: '1px solid rgba(255,255,255,0.10)',
                borderRight: col === 8 ? '1px solid rgba(255,255,255,0.10)' : 'none',
                borderBottom: r === 8 ? '1px solid rgba(255,255,255,0.10)' : 'none',
                boxShadow: sel ? (wrong ? 'inset 0 0 0 1px #ff5555' : 'inset 0 0 0 1.5px #ffffff') : 'none',
              }}
            >
              {c.value !== 0 ? c.value : (sel ? <span className="sudoku-caret" style={{ height: Math.round(cell * 0.5) }} /> : '')}
            </div>
          );
        })}
      </div>
      {/* thick 3×3 box separators, drawn on top so they read cleanly */}
      <div className="absolute inset-0 pointer-events-none">
        {[0, 1, 2, 3].map((k) => (
          <React.Fragment key={k}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: k * 3 * cell, height: 2, background: '#9aa0a6', opacity: 0.55 }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: k * 3 * cell, width: 2, background: '#9aa0a6', opacity: 0.55 }} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  // ── Number pad — all 10 keys (1-9 + erase) sized to fit one row across the grid ─
  const padGap = isMobile ? 4 : 6;
  const padBtn = Math.floor((gridPx - 9 * padGap) / 10);
  const renderPad = () => (
    <div className="flex justify-center mt-8" style={{ width: gridPx, maxWidth: '100%', gap: padGap }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const left = remaining(d);
        const done = left <= 0;
        return (
          <button
            key={d}
            onClick={() => { setCellValue(selected, d); boardAreaRef.current && boardAreaRef.current.focus({ preventScroll: true }); }}
            disabled={done || selected == null}
            className="relative font-mono rounded-md border border-[#3a3a3a] bg-[#262626] text-gray-100 flex items-center justify-center transition-colors hover:border-[#00ff66] disabled:opacity-30 disabled:hover:border-[#3a3a3a] disabled:cursor-not-allowed cursor-pointer"
            style={{ width: padBtn, height: padBtn, fontSize: padBtn * 0.42 }}
          >
            {d}
            <span className="absolute bottom-0.5 right-1 text-[9px] text-gray-500 leading-none">{left > 0 ? left : ''}</span>
          </button>
        );
      })}
      <button
        onClick={() => { clearCell(selected); boardAreaRef.current && boardAreaRef.current.focus({ preventScroll: true }); }}
        disabled={selected == null}
        title="Erase"
        className="font-mono rounded-md border border-[#3a3a3a] bg-[#262626] text-gray-400 flex items-center justify-center transition-colors hover:border-[#ff5555] hover:text-[#ff5555] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        style={{ width: padBtn, height: padBtn, fontSize: padBtn * 0.34 }}
      >⌫</button>
    </div>
  );

  // ── Difficulty toggle — cycles easy ‹›‹› medium ‹›‹› hard, starting a new game ─
  const cycleDifficulty = () => {
    const order = Object.keys(DIFFICULTIES);
    chooseDifficulty(order[(order.indexOf(difficulty) + 1) % order.length]);
  };
  const diffToggle = () => (
    <button
      onClick={cycleDifficulty}
      title="Cycle difficulty (starts a new game)"
      className="flex items-center gap-1 uppercase text-[#00ff66] hover:text-white active:text-white transition-colors cursor-pointer"
    >
      <span className="text-gray-600">‹</span>{difficulty}<span className="text-gray-600">›</span>
    </button>
  );

  return (
    <div className="relative flex flex-col h-full w-full">
      <WindowControls>
        {diffToggle()}
        <button onClick={useHint} disabled={hintsLeft === 0} className="hover:text-white active:text-white transition-colors uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Hint ({hintsLeft})</button>
        <button onClick={() => startNewGame()} className="hover:text-white active:text-white transition-colors uppercase cursor-pointer">New</button>
      </WindowControls>

      {/* Board + pad (focusable so the keyboard always works) */}
      <div
        ref={boardAreaRef}
        tabIndex={0}
        onKeyDown={handleBoardKey}
        className={`flex-1 flex flex-col items-center justify-center outline-none ${isMobile ? 'px-2 py-3' : 'p-6'} relative overflow-hidden ${gameOver ? 'pointer-events-none' : ''}`}
      >
        {cells.length > 0 && status !== 'won' && renderGrid()}
        {cells.length > 0 && status !== 'won' && renderPad()}
        {/* Win: grid gone — numbers drop and pile on the terminal panel (gravity physics) */}
        {status === 'won' && (
          <canvas ref={physCanvasRef} className="absolute inset-0 w-full h-full pointer-events-auto select-none z-40" />
        )}
      </div>

      {/* Win terminal panel */}
      {gameOver && (
        <div
          ref={winPanelRef}
          onClick={dismissPanel}
          className={`terminal-panel ${panelExiting ? 'panel-exit' : ''} absolute bottom-0 left-0 right-0 z-50 bg-[#181818] border-t border-[#2d2d2d] font-mono text-xs cursor-pointer`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-4 px-4 h-7 border-b border-gray-800 text-[11px] uppercase tracking-wider">
            <span className="text-gray-200">Terminal</span>
            <span className="ml-auto normal-case text-gray-600">zsh — exit 0</span>
          </div>
          <div className="px-4 py-3 leading-relaxed">
            <p className="text-[#00ff66]">sudoku: puzzle solved</p>
            <p className="text-[#00ff66]">sudoku: {difficulty} complete</p>
            <p className="text-gray-500">exit status 0 · {fmtTime(seconds)} · {mistakes} mistakes</p>
            <p className="mt-2 text-gray-300">{isMobile ? 'tap to play again' : 'press [ENTER] to play again'}<span className="prompt-cursor" /></p>
          </div>
        </div>
      )}
    </div>
  );
};
