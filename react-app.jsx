import React, { useState, useEffect, useCallback, useRef } from 'react';

const SUITS = [
  { id: 'spades', symbol: '♠', color: 'white' },
  { id: 'hearts', symbol: '♥', color: 'red' },
  { id: 'clubs', symbol: '♣', color: 'white' },
  { id: 'diamonds', symbol: '♦', color: 'red' }
];

const RANKS = [
  { value: 1, label: 'A' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: 'J' },
  { value: 12, label: 'Q' },
  { value: 13, label: 'K' }
];

const createDeck = () => {
  let deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `card-${id++}`,
        suit: suit.id,
        symbol: suit.symbol,
        color: suit.color,
        rank: rank.value,
        label: rank.label,
        isFaceUp: false
      });
    }
  }
  return deck;
};

const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const Card = ({ card, onClick, onDoubleClick, onPointerDown, isSelected, showCursor, isHint, isDragging, isEmptyPlaceholder }) => {
  const size = { width: 'var(--cw)', height: 'var(--ch)' };

  if (isEmptyPlaceholder) {
    return (
      <div
        onClick={onClick}
        style={size}
        className={`border rounded-md box-border cursor-pointer ${isHint ? 'border-[#00ff66] ring-2 ring-[#00ff66] z-20' : 'border-gray-600/50'}`}
      />
    );
  }

  if (!card.isFaceUp) {
    return (
      <div
        onClick={onClick}
        style={size}
        className={`border border-white rounded-md box-border cursor-pointer bg-[#1e1e1e] overflow-hidden
          ${isSelected ? '-translate-y-1 z-10' : ''} ${isHint ? 'ring-2 ring-[#00ff66] z-20' : ''} transition-transform duration-100`}
      >
        <div className="w-full h-full striped-bg"></div>
      </div>
    );
  }

  const textColorClass = card.color === 'red' ? 'text-[#ff5555]' : 'text-gray-100';
  const labelBase = `absolute px-1 py-2 card-label font-mono font-medium ${textColorClass} flex items-center leading-none`;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      style={size}
      className={`border ${card.color === 'red' ? 'border-[#ff5555]' : 'border-white'} rounded-md box-border cursor-pointer relative bg-[#1e1e1e] touch-none
        ${isSelected ? '-translate-y-1 z-10' : ''} ${isHint ? 'ring-2 ring-[#00ff66] z-20' : ''} ${isDragging ? 'invisible' : ''} transition-transform duration-100`}
    >
      {showCursor && <span className="card-cursor" style={{ width: 'var(--curw)', height: 'var(--curh)' }} />}
      <div className={labelBase} style={{ top: 0, left: 'var(--lleft)', transform: 'translateY(-50%)', fontSize: 'var(--rank)' }}>
        {card.label}<span style={{ marginLeft: 1, fontSize: 'var(--suit)' }}>{card.symbol}</span>
      </div>
      <div className={labelBase} style={{ bottom: 0, right: 'var(--lleft)', transform: 'translateY(50%) rotate(180deg)', fontSize: 'var(--rank)' }}>
        {card.label}<span style={{ marginLeft: 1, fontSize: 'var(--suit)' }}>{card.symbol}</span>
      </div>
    </div>
  );
};

const TerminalSolitaire = () => {
  const [stock, setStock] = useState([]);
  const [waste, setWaste] = useState([]);
  const [foundations, setFoundations] = useState([[], [], [], []]);
  const [tableaus, setTableaus] = useState([[], [], [], [], [], [], []]);
  const [selected, setSelected] = useState(null);
  const [hasWon, setHasWon] = useState(false);
  const [noMoves, setNoMoves] = useState(false);
  const [hint, setHint] = useState(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [moveCount, setMoveCount] = useState(0);
  const [maximized, setMaximized] = useState(false);
  const [panelExiting, setPanelExiting] = useState(false); // slide the game-over panel down on ENTER

  // Layout mode. Desktop (>=640px) keeps a fixed-size board that never rescales;
  // mobile (<640px) goes full-screen and scales cards to fit 7 columns across.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches);
  const [boardSize, setBoardSize] = useState(() => ({
    w: typeof window !== 'undefined' ? Math.min(872, window.innerWidth - 24) : 872,
    tableauH: 600,
  }));
  const [headerH, setHeaderH] = useState(32);

  const DESKTOP_BOARD_W = 872;
  const MOBILE_GAP = 10;

  // Card geometry is derived from a single cardW; everything else (labels, cursor,
  // win cascade) scales off it, so making cardW responsive flows everywhere.
  let cardW, cardH, defaultFan;
  if (isMobile) {
    cardW = Math.max(38, Math.floor((boardSize.w - 6 * MOBILE_GAP) / 7));
    cardH = Math.round(cardW * 1.5);
    defaultFan = Math.round(cardH * 0.26);
  } else {
    cardW = 102;
    cardH = 153;
    defaultFan = 24;
  }
  const BOARD_W = isMobile ? boardSize.w : DESKTOP_BOARD_W;

  // Adaptive fan (mobile only): tighten a column's overlap just enough to fit the
  // available height, never below the rank-label height. Desktop is always uniform.
  const minFan = Math.max(Math.round(cardH * 0.16), Math.round(cardW * 0.24));
  const fanFor = (n) => {
    if (!isMobile || n <= 1) return defaultFan;
    const fit = (boardSize.tableauH - cardH) / (n - 1);
    return Math.max(minFan, Math.min(defaultFan, fit));
  };

  const winCanvasRef = useRef(null);
  const winPanelRef = useRef(null);
  const foundationRefs = useRef([]);
  const boardInnerRef = useRef(null); // the 7-column wrapper (measured for width)
  const tableauRef = useRef(null);    // the tableau row (measured for available height)
  const headerRef = useRef(null);     // title/control bar (measured to place the canvas)
  const lastTapRef = useRef({ t: 0, key: '' }); // manual double-tap detection on touch

  // drag-and-drop (coexists with click-to-move)
  const [drag, setDrag] = useState(null); // { cards, source, x, y } while a drag is active
  const dragRef = useRef(null);           // live drag bookkeeping (synchronous)
  const gameRef = useRef(null);           // fresh state + helpers for the window listeners
  const floatRef = useRef(null);          // the floating dragged-card layer
  const didDragRef = useRef(false);       // suppress the click that follows a drag

  const startNewGame = useCallback(() => {
    let deck = shuffle(createDeck());
    let newTableaus = [[], [], [], [], [], [], []];
    for (let i = 0; i < 7; i++) {
      for (let j = i; j < 7; j++) {
        let card = deck.pop();
        if (i === j) card.isFaceUp = true;
        newTableaus[j].push(card);
      }
    }
    setTableaus(newTableaus);
    setStock(deck);
    setWaste([]);
    setFoundations([[], [], [], []]);
    setSelected(null);
    setHasWon(false);
    setNoMoves(false);
    setHint(null);
    setHintsLeft(3);
    setMoveCount(0);
  }, []);

  // Dismiss the game-over panel and deal a fresh game (ENTER on desktop, tap on
  // mobile — which has no keyboard, so this is the only way out of a win/loss there).
  const dismissPanel = useCallback(() => {
    setPanelExiting((exiting) => {
      if (exiting) return exiting; // already sliding out
      setTimeout(() => { startNewGame(); setPanelExiting(false); }, 240);
      return true;
    });
  }, [startNewGame]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  // Track layout mode + orientation.
  useEffect(() => {
    const mqW = window.matchMedia('(max-width: 639px)');
    const mqO = window.matchMedia('(orientation: landscape)');
    const onW = () => setIsMobile(mqW.matches);
    const onO = () => setIsLandscape(mqO.matches);
    mqW.addEventListener('change', onW);
    mqO.addEventListener('change', onO);
    return () => { mqW.removeEventListener('change', onW); mqO.removeEventListener('change', onO); };
  }, []);

  // Measure the board (width drives card size; tableau height drives the adaptive
  // fan; header height places the win-cascade canvas). Debounced via rAF.
  useEffect(() => {
    const inner = boardInnerRef.current;
    if (!inner) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setBoardSize({
          w: inner.clientWidth,
          tableauH: tableauRef.current ? tableauRef.current.clientHeight : 600,
        });
        if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    if (tableauRef.current) ro.observe(tableauRef.current);
    if (headerRef.current) ro.observe(headerRef.current);
    measure();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [isMobile]);

  useEffect(() => {
    const totalInFoundations = foundations.reduce((sum, f) => sum + f.length, 0);
    if (totalInFoundations === 52) {
      setHasWon(true);
    }
  }, [foundations]);

  useEffect(() => {
    if (hasWon) { setNoMoves(false); return; }
    const totalCards =
      stock.length + waste.length +
      foundations.reduce((s, f) => s + f.length, 0) +
      tableaus.reduce((s, t) => s + t.length, 0);
    if (totalCards === 0) { setNoMoves(false); return; } // not dealt yet
    setNoMoves(!hasAnyMove());
  }, [stock, waste, tableaus, foundations, hasWon]);

  // Auto-complete: once the win is guaranteed (every card face-up, stock & waste empty),
  // sweep the remaining cards to the foundations automatically — these moves don't count.
  useEffect(() => {
    if (hasWon) return;
    const total = foundations.reduce((s, f) => s + f.length, 0);
    const inPlay = stock.length + waste.length + total + tableaus.reduce((s, t) => s + t.length, 0);
    const allFaceUp = tableaus.every((col) => col.every((c) => c.isFaceUp));
    if (inPlay !== 52 || total === 52 || stock.length || waste.length || !allFaceUp) return;

    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const g = gameRef.current;
      for (let i = 0; i < 7; i++) {
        const col = g.tableaus[i];
        if (!col.length) continue;
        const card = col[col.length - 1];
        for (let fi = 0; fi < 4; fi++) {
          if (g.canMoveToFoundation(card, fi)) {
            g.executeMove({ area: 'tableau', index: i, cardIndex: col.length - 1 }, { area: 'foundation', index: fi }, [card], true);
            return; // the re-render re-runs this effect, which schedules the next card
          }
        }
      }
    };
    const t = setTimeout(step, 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [stock, waste, tableaus, foundations, hasWon]);

  useEffect(() => {
    if (!noMoves && !hasWon) return;
    const onKey = (e) => {
      if (e.key !== 'Enter') return;
      dismissPanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [noMoves, hasWon, dismissPanel]);

  // Global pointer listeners drive drag-and-drop (mouse + touch via Pointer Events).
  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < (d.touch ? 8 : 5)) return;
        d.moved = true;
        didDragRef.current = true;
        const sel = window.getSelection && window.getSelection();
        if (sel) sel.removeAllRanges();
        setDrag({ cards: d.cards, source: d.source, x: e.clientX - d.offsetX, y: e.clientY - d.offsetY, fan: d.fan });
      } else if (floatRef.current) {
        e.preventDefault();
        floatRef.current.style.left = `${e.clientX - d.offsetX}px`;
        floatRef.current.style.top = `${e.clientY - d.offsetY}px`;
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (!d.moved) return; // it was a click, not a drag
      const g = gameRef.current;

      // center of the released card
      const fr = floatRef.current ? floatRef.current.getBoundingClientRect() : null;
      const cx = fr ? fr.left + fr.width / 2 : d.origin.left + g.cardW / 2;
      const cy = fr ? fr.top + fr.height / 2 : d.origin.top + g.cardH / 2;

      // pick the nearest VALID pile to where the card was released
      let best = null;
      let bestDist = Infinity;
      document.querySelectorAll('[data-drop]').forEach((el) => {
        const [area, idxStr] = el.getAttribute('data-drop').split(':');
        const idx = parseInt(idxStr, 10);
        const ok = area === 'tableau'
          ? g.canMoveToTableau(d.cards, idx)
          : (area === 'foundation' && d.cards.length === 1 && g.canMoveToFoundation(d.cards[0], idx));
        if (!ok) return;
        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - cx, 0, cx - r.right);
        const dy = Math.max(r.top - cy, 0, cy - r.bottom);
        const dist = Math.hypot(dx, dy); // 0 when the card center is over the pile
        if (dist < bestDist) { bestDist = dist; best = { area, idx, rect: r }; }
      });

      const settle = (left, top, after) => {
        if (!floatRef.current) { after(); return; }
        floatRef.current.style.transition = 'left 0.16s ease-out, top 0.16s ease-out';
        floatRef.current.style.left = `${left}px`;
        floatRef.current.style.top = `${top}px`;
        setTimeout(after, 160);
      };

      if (best && bestDist < Math.max(40, g.cardW * 0.7)) {
        // glide into the destination slot, then commit
        let targetTop = best.rect.top;
        if (best.area === 'tableau') {
          const len = g.tableaus[best.idx].length;
          const f = g.fanFor(len + d.cards.length);
          targetTop = best.rect.top + (len === 0 ? 0 : len * f);
        }
        settle(best.rect.left, targetTop, () => {
          g.executeMove(d.source, { area: best.area, index: best.idx }, d.cards);
          setDrag(null);
        });
      } else {
        // no valid target nearby — glide back to where it was picked up
        settle(d.origin.left, d.origin.top, () => setDrag(null));
      }
    };
    const onKey = (e) => {
      const g = gameRef.current;
      if (!g || g.hasWon || g.noMoves) return;
      if (e.key === 'r' || e.key === 'R') g.handleStockClick(); // recycle/draw the stock
    };
    window.addEventListener('keydown', onKey);
    const onCancel = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDrag(null); // abandon the drag; cards reappear in place
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, []);

  // Classic Windows-Solitaire win cascade: each foundation card bounces off the
  // bottom under gravity, leaving a trail (the canvas is never cleared).
  useEffect(() => {
    if (!hasWon) return;
    let rafId;
    let cancelled = false;
    const CARD_W = cardW, CARD_H = cardH, GRAVITY = 0.5, BOUNCE = 0.8;

    const drawCard = (ctx, x, y, card) => {
      const rad = Math.max(4, cardW * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + CARD_W, y, x + CARD_W, y + CARD_H, rad);
      ctx.arcTo(x + CARD_W, y + CARD_H, x, y + CARD_H, rad);
      ctx.arcTo(x, y + CARD_H, x, y, rad);
      ctx.arcTo(x, y, x + CARD_W, y, rad);
      ctx.closePath();
      ctx.fillStyle = '#1e1e1e';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = card.color === 'red' ? '#ff5555' : '#ffffff';
      ctx.stroke();

      // rank + smaller suit straddling the border in the top-left and bottom-right
      // corners — same look as the in-game card label.
      const ink = card.color === 'red' ? '#ff5555' : '#f3f4f6';
      const corner = (flip) => {
        ctx.save();
        if (flip) { ctx.translate(x + CARD_W, y + CARD_H); ctx.rotate(Math.PI); }
        else { ctx.translate(x, y); }
        ctx.font = `500 ${cardW * 0.16}px "Fira Code", monospace`;
        const rankW = ctx.measureText(card.label).width;
        ctx.font = `500 ${cardW * 0.12}px "Fira Code", monospace`;
        const suitW = ctx.measureText(card.symbol).width;
        const startX = cardW * 0.08;
        // feathered patch: opaque behind the rank/suit, fading to transparent at
        // the top and bottom edges only (4px side padding, like .card-label)
        const padX = 4;
        const patchH = cardH * 0.21;
        const grad = ctx.createLinearGradient(0, -patchH / 2, 0, patchH / 2);
        grad.addColorStop(0, 'rgba(30,30,30,0)');
        grad.addColorStop(0.28, '#1e1e1e');
        grad.addColorStop(0.72, '#1e1e1e');
        grad.addColorStop(1, 'rgba(30,30,30,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(startX - padX, -patchH / 2, rankW + 1 + suitW + padX * 2, patchH);
        // rank + suit, vertically centered on the card edge (straddling)
        ctx.fillStyle = ink;
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${cardW * 0.16}px "Fira Code", monospace`;
        ctx.fillText(card.label, startX, 0);
        ctx.font = `500 ${cardW * 0.12}px "Fira Code", monospace`;
        ctx.fillText(card.symbol, startX + rankW + 1, 1);
        ctx.restore();
      };
      corner(false);
      corner(true);
    };

    const begin = () => {
      if (cancelled) return;
      const canvas = winCanvasRef.current;
      if (!canvas) { rafId = requestAnimationFrame(begin); return; }
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (!W || !H) { rafId = requestAnimationFrame(begin); return; } // wait for layout
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); // draw in logical px; crisp on HiDPI / Retina
      ctx.clearRect(0, 0, W, H);

      // bounce just above the docked terminal panel (measured, not a cardH guess)
      const panelH = winPanelRef.current ? winPanelRef.current.offsetHeight : cardH;
      const floor = H - panelH;
      const canvasRect = canvas.getBoundingClientRect();
      const starts = foundationRefs.current.map((el) => {
        if (!el) return { x: W * 0.6, y: 8 };
        const r = el.getBoundingClientRect();
        return { x: r.left - canvasRect.left, y: r.top - canvasRect.top };
      });

      const queue = [];
      for (let rank = 12; rank >= 0; rank--) {
        for (let i = 0; i < 4; i++) {
          const card = foundations[i] && foundations[i][rank];
          const s = starts[i] || { x: W * 0.6, y: 8 };
          if (card) queue.push({ card, sx: s.x, sy: s.y });
        }
      }

      const active = [];
      let sinceLaunch = 999;
      const tick = () => {
        if (cancelled) return;
        sinceLaunch++;
        // slight overlap: up to 2 cards in flight, launched in random directions
        if (queue.length && active.length < 2 && sinceLaunch >= 24) {
          const n = queue.shift();
          active.push({
            card: n.card,
            x: n.sx,
            y: n.sy,
            vx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5),
            vy: -(1 + Math.random() * 5),
            bounce: BOUNCE * (0.6 + Math.random() * 0.5), // per-card so arc heights vary
          });
          sinceLaunch = 0;
        }
        for (let k = active.length - 1; k >= 0; k--) {
          const c = active[k];
          c.vy += GRAVITY;
          c.x += c.vx;
          c.y += c.vy;
          if (c.y + CARD_H >= floor) { c.y = floor - CARD_H; c.vy = -c.vy * c.bounce; }
          drawCard(ctx, c.x, c.y, c.card);
          if (c.x < -CARD_W || c.x > W) active.splice(k, 1);
        }
        if (queue.length || active.length) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(begin);
    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  }, [hasWon, foundations]);

  const canMoveToTableau = (cardsToMove, destTableauIndex) => {
    const bottomCard = cardsToMove[0];
    const destPile = tableaus[destTableauIndex];
    if (destPile.length === 0) {
      return bottomCard.rank === 13;
    }
    const topDestCard = destPile[destPile.length - 1];
    return topDestCard.color !== bottomCard.color && topDestCard.rank === bottomCard.rank + 1;
  };

  const canMoveToFoundation = (card, destFoundationIndex) => {
    const destPile = foundations[destFoundationIndex];
    if (destPile.length === 0) {
      return card.rank === 1;
    }
    const topDestCard = destPile[destPile.length - 1];
    return topDestCard.suit === card.suit && topDestCard.rank + 1 === card.rank;
  };

  const autoFindFoundation = (card) => {
    for (let i = 0; i < 4; i++) {
      if (canMoveToFoundation(card, i)) return i;
    }
    return -1;
  };

  const canSendToFoundation = (c) => {
    for (let fi = 0; fi < 4; fi++) if (canMoveToFoundation(c, fi)) return true;
    return false;
  };

  // "No moves left" detection. A move only counts if it makes PROGRESS — a pointless
  // shuffle of face-up cards between columns is ignored, since it loops forever without
  // advancing the game. The stock is scanned in full (unlimited recycling makes every
  // stock/waste card reachable). Progress = a card reaches a foundation, a face-down card
  // is flipped, a stock/waste card enters play, a covered foundation-ready card is
  // exposed, or a column is freed.
  const hasAnyMove = () => {
    // 1. Any reachable card (tableau tops + every waste + every stock card) -> foundation
    for (let i = 0; i < 7; i++) {
      const top = tableaus[i][tableaus[i].length - 1];
      if (top && top.isFaceUp && canSendToFoundation(top)) return true;
    }
    for (const c of waste) if (canSendToFoundation(c)) return true;
    for (const c of stock) if (canSendToFoundation(c)) return true;

    // 2. Any stock/waste card -> a tableau (brings a new card into play)
    for (const c of [...waste, ...stock]) {
      for (let ti = 0; ti < 7; ti++) if (canMoveToTableau([c], ti)) return true;
    }

    // 3. Tableau -> tableau, but only moves that make progress
    for (let i = 0; i < 7; i++) {
      const pile = tableaus[i];
      if (pile.length === 0) continue;
      const firstFaceUp = pile.findIndex((c) => c.isFaceUp);
      if (firstFaceUp === -1) continue;
      for (let s = firstFaceUp; s < pile.length; s++) {
        let makesProgress;
        if (s === 0) {
          makesProgress = true; // moving the whole pile frees a column
        } else {
          const beneath = pile[s - 1];
          // flips a face-down card, or exposes a face-up card that can go to a foundation
          makesProgress = !beneath.isFaceUp || canSendToFoundation(beneath);
        }
        if (!makesProgress) continue;
        const runBottom = pile[s];
        for (let j = 0; j < 7; j++) {
          if (j === i) continue;
          if (s === 0 && tableaus[j].length === 0) continue; // ignore King<->empty shuffles
          if (canMoveToTableau([runBottom], j)) return true;
        }
      }
    }

    return false;
  };

  // Suggest the most useful currently-available move (for the Hint button).
  const findHint = () => {
    // 1. waste top -> foundation
    if (waste.length) {
      const c = waste[waste.length - 1];
      for (let fi = 0; fi < 4; fi++) if (canMoveToFoundation(c, fi)) return { from: { area: 'waste', index: 0, cardIndex: waste.length - 1 }, to: { area: 'foundation', index: fi } };
    }
    // 2. tableau top -> foundation
    for (let i = 0; i < 7; i++) {
      const p = tableaus[i]; const t = p[p.length - 1];
      if (t && t.isFaceUp) for (let fi = 0; fi < 4; fi++) if (canMoveToFoundation(t, fi)) return { from: { area: 'tableau', index: i, cardIndex: p.length - 1 }, to: { area: 'foundation', index: fi } };
    }
    // 3. tableau run that flips a face-down card -> tableau
    for (let i = 0; i < 7; i++) {
      const p = tableaus[i]; if (!p.length) continue;
      const f = p.findIndex((c) => c.isFaceUp);
      if (f <= 0) continue;
      for (let j = 0; j < 7; j++) if (j !== i && canMoveToTableau([p[f]], j)) return { from: { area: 'tableau', index: i, cardIndex: f }, to: { area: 'tableau', index: j } };
    }
    // 4. waste top -> tableau
    if (waste.length) {
      const c = waste[waste.length - 1];
      for (let j = 0; j < 7; j++) if (canMoveToTableau([c], j)) return { from: { area: 'waste', index: 0, cardIndex: waste.length - 1 }, to: { area: 'tableau', index: j } };
    }
    // 5. any other progress tableau -> tableau
    for (let i = 0; i < 7; i++) {
      const p = tableaus[i]; if (!p.length) continue;
      const f = p.findIndex((c) => c.isFaceUp); if (f === -1) continue;
      for (let s = f; s < p.length; s++) {
        const prog = s === 0 ? true : (!p[s - 1].isFaceUp || canSendToFoundation(p[s - 1]));
        if (!prog) continue;
        for (let j = 0; j < 7; j++) {
          if (j === i) continue;
          if (s === 0 && tableaus[j].length === 0) continue;
          if (canMoveToTableau([p[s]], j)) return { from: { area: 'tableau', index: i, cardIndex: s }, to: { area: 'tableau', index: j } };
        }
      }
    }
    // 6. fallback: draw / recycle the stock
    if (stock.length || waste.length) return { from: { area: 'stock' }, to: null };
    return null;
  };

  const showHint = () => {
    if (hintsLeft <= 0) return;
    const move = findHint();
    if (!move) return;
    setSelected(null);
    setHint(move);
    setHintsLeft((h) => h - 1);
    setTimeout(() => setHint(null), 2500);
  };

  const isHintFrom = (area, index, cardIndex) =>
    hint && hint.from && hint.from.area === area && hint.from.index === index && hint.from.cardIndex === cardIndex;
  const isHintTo = (area, index) =>
    hint && hint.to && hint.to.area === area && hint.to.index === index;

  const flipExposedTableauCard = (newTableaus, tIndex) => {
    if (newTableaus[tIndex].length > 0) {
      const lastCard = newTableaus[tIndex][newTableaus[tIndex].length - 1];
      if (!lastCard.isFaceUp) {
        newTableaus[tIndex][newTableaus[tIndex].length - 1] = { ...lastCard, isFaceUp: true };
      }
    }
  };

  const handlePointerDown = (e, area, index, cardIndex) => {
    if (e.button != null && e.button > 0) return; // ignore right/middle click
    didDragRef.current = false;
    let card;
    if (area === 'waste') card = waste[waste.length - 1];
    else if (area === 'foundation') card = foundations[index][foundations[index].length - 1];
    else if (area === 'tableau') card = tableaus[index][cardIndex];
    if (!card || !card.isFaceUp) return;
    const cards = area === 'tableau' ? tableaus[index].slice(cardIndex) : [card];
    if (!cards.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      source: { area, index, cardIndex },
      cards,
      startX: e.clientX, startY: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      origin: { left: rect.left, top: rect.top },
      fan: area === 'tableau' ? fanFor(tableaus[index].length) : defaultFan,
      touch: e.pointerType === 'touch',
      moved: false,
    };
  };

  const isDragging = (area, index, cardIndex) => {
    if (!drag) return false;
    const s = drag.source;
    if (s.area !== area || s.index !== index) return false;
    if (area === 'tableau') return cardIndex >= s.cardIndex;
    return true;
  };

  const handleStockClick = () => {
    setSelected(null);
    setHint(null);
    if (stock.length > 0) {
      const newStock = [...stock];
      const card = { ...newStock.pop(), isFaceUp: true };
      setStock(newStock);
      setWaste([...waste, card]);
      setMoveCount(m => m + 1);
    } else if (waste.length > 0) {
      const newWaste = [...waste].reverse().map(c => ({ ...c, isFaceUp: false }));
      setStock(newWaste);
      setWaste([]);
      setMoveCount(m => m + 1);
    }
  };

  const handleCardClick = (e, area, index, cardIndex) => {
    e.stopPropagation();
    if (didDragRef.current) { didDragRef.current = false; return; } // a drag just happened; ignore the click

    // Manual double-tap → send to foundation (mobile; native dblclick is flaky on touch).
    if (isMobile) {
      const key = `${area}:${index}:${cardIndex}`;
      const now = Date.now();
      if (now - lastTapRef.current.t < 300 && lastTapRef.current.key === key) {
        lastTapRef.current = { t: 0, key: '' };
        sendTopToFoundation(area, index, cardIndex);
        return;
      }
      lastTapRef.current = { t: now, key };
    }

    if (!selected) {
      let card;
      if (area === 'waste') card = waste[waste.length - 1];
      else if (area === 'tableau') card = tableaus[index][cardIndex];
      else if (area === 'foundation') card = foundations[index][foundations[index].length - 1];

      if (card && card.isFaceUp) {
        setSelected({ area, index, cardIndex });
      }
      return;
    }

    if (selected.area === area && selected.index === index && selected.cardIndex === cardIndex) {
      setSelected(null);
      return;
    }

    let cardsToMove = [];
    if (selected.area === 'waste') {
      cardsToMove = [waste[waste.length - 1]];
    } else if (selected.area === 'foundation') {
      cardsToMove = [foundations[selected.index][foundations[selected.index].length - 1]];
    } else if (selected.area === 'tableau') {
      cardsToMove = tableaus[selected.index].slice(selected.cardIndex);
    }

    if (cardsToMove.length === 0) {
      setSelected(null);
      return;
    }

    if (area === 'tableau') {
      if (canMoveToTableau(cardsToMove, index)) {
        executeMove(selected, { area: 'tableau', index }, cardsToMove);
        return;
      }
    }

    if (area === 'foundation' && cardsToMove.length === 1) {
      if (canMoveToFoundation(cardsToMove[0], index)) {
        executeMove(selected, { area: 'foundation', index }, cardsToMove);
        return;
      }
    }

    let clickedCard;
    if (area === 'waste') clickedCard = waste[waste.length - 1];
    else if (area === 'foundation') clickedCard = foundations[index][foundations[index].length - 1];
    else if (area === 'tableau') clickedCard = tableaus[index][cardIndex];
    if (clickedCard && clickedCard.isFaceUp) {
      setSelected({ area, index, cardIndex });
    } else {
      setSelected(null);
    }
  };

  const handleEmptyPileClick = (area, index) => {
    if (!selected) return;

    let cardsToMove = [];
    if (selected.area === 'waste') cardsToMove = [waste[waste.length - 1]];
    else if (selected.area === 'foundation') cardsToMove = [foundations[selected.index][foundations[selected.index].length - 1]];
    else if (selected.area === 'tableau') cardsToMove = tableaus[selected.index].slice(selected.cardIndex);

    if (cardsToMove.length === 0) return;

    if (area === 'tableau') {
      if (canMoveToTableau(cardsToMove, index)) {
        executeMove(selected, { area: 'tableau', index }, cardsToMove);
      }
    } else if (area === 'foundation' && cardsToMove.length === 1) {
      if (canMoveToFoundation(cardsToMove[0], index)) {
        executeMove(selected, { area: 'foundation', index }, cardsToMove);
      }
    }

    setSelected(null);
  };

  // Send a top card straight to its foundation (the double-click / double-tap action).
  const sendTopToFoundation = (area, index, cardIndex) => {
    let card;
    if (area === 'waste') card = waste[waste.length - 1];
    else if (area === 'tableau' && cardIndex === tableaus[index].length - 1) card = tableaus[index][cardIndex];

    if (!card || !card.isFaceUp) return;

    const targetFoundationIndex = autoFindFoundation(card);
    if (targetFoundationIndex !== -1) {
      executeMove({ area, index, cardIndex }, { area: 'foundation', index: targetFoundationIndex }, [card]);
      setSelected(null);
    }
  };

  const handleDoubleClick = (e, area, index, cardIndex) => {
    e.stopPropagation();
    if (isMobile) return; // mobile drives this via manual double-tap detection (dblclick is unreliable on touch)
    sendTopToFoundation(area, index, cardIndex);
  };

  const executeMove = (source, dest, cards, silent = false) => {
    if (source.area === 'waste') {
      setWaste(w => w.slice(0, -1));
    } else if (source.area === 'foundation') {
      setFoundations(f => {
        const nf = [...f];
        nf[source.index] = nf[source.index].slice(0, -1);
        return nf;
      });
    } else if (source.area === 'tableau') {
      setTableaus(t => {
        const nt = [...t];
        nt[source.index] = nt[source.index].slice(0, source.cardIndex);
        flipExposedTableauCard(nt, source.index);
        return nt;
      });
    }

    if (dest.area === 'tableau') {
      setTableaus(t => {
        const nt = [...t];
        nt[dest.index] = [...nt[dest.index], ...cards];
        return nt;
      });
    } else if (dest.area === 'foundation') {
      setFoundations(f => {
        const nf = [...f];
        nf[dest.index] = [...nf[dest.index], ...cards];
        return nf;
      });
    }

    if (!silent) setMoveCount(m => m + 1); // auto-complete moves don't count
    setSelected(null);
    setHint(null);
  };

  const isCardSelected = (area, index, cardIndex) => {
    if (!selected) return false;
    if (selected.area !== area) return false;

    if (area === 'waste' || area === 'foundation') {
      return selected.index === index;
    }

    if (area === 'tableau' && selected.index === index) {
      return cardIndex >= selected.cardIndex;
    }
    return false;
  };

  const isSelectionHead = (area, index, cardIndex) => {
    if (!selected) return false;
    if (selected.area !== area) return false;
    if (area === 'waste' || area === 'foundation') return selected.index === index;
    if (area === 'tableau' && selected.index === index) return cardIndex >= selected.cardIndex;
    return false;
  };

  gameRef.current = { waste, foundations, tableaus, canMoveToTableau, canMoveToFoundation, executeMove, handleStockClick, hasWon, noMoves, cardW, cardH, fanFor };

  return (
    <div
      className={`terminal-bg flex flex-col overflow-hidden fixed inset-0 m-auto z-40 ${isMobile ? '' : 'border border-[#2d2d2d]'}`}
      style={{
        width: isMobile ? '100%' : (maximized ? '100%' : 'min(60rem, calc(100% - 2rem))'),
        height: isMobile ? '100dvh' : (maximized ? '100%' : 'min(800px, calc(100% - 2rem))'),
        borderRadius: isMobile ? '0px' : (maximized ? '0px' : '12px'),
        boxShadow: isMobile ? 'none' : (maximized ? 'none' : '0 20px 50px rgba(0,0,0,0.5)'),
        transition: isMobile ? 'none' : 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease',
        '--cw': `${cardW}px`,
        '--ch': `${cardH}px`,
        '--rank': `${cardW * (isMobile ? 0.25 : 0.16)}px`,
        '--suit': `${cardW * (isMobile ? 0.20 : 0.12)}px`,
        '--lleft': `${cardW * 0.06}px`,
        '--curw': `${Math.max(2, Math.round(cardW * 0.03))}px`,
        '--curh': `${cardH * 0.19}px`,
      }}
    >
      {isMobile ? (
        <div
          ref={headerRef}
          className="bg-[#2d2d2d] flex items-center justify-between px-4 pb-2 flex-shrink-0 border-b border-black text-xs text-gray-400 uppercase tracking-wide"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <span className="text-gray-500">Moves: {moveCount}</span>
          <button onClick={showHint} disabled={hintsLeft === 0} className="cursor-pointer active:text-white disabled:opacity-40 disabled:cursor-not-allowed">Hint ({hintsLeft})</button>
          <button onClick={startNewGame} className="cursor-pointer active:text-white">Restart</button>
        </div>
      ) : (
        <div ref={headerRef} className="bg-[#2d2d2d] h-8 flex items-center px-4 relative flex-shrink-0 border-b border-black">
          <div className="flex gap-2 z-10">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
            <div onClick={() => setMaximized((m) => !m)} title="Toggle full screen" className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm font-semibold tracking-wider">Solitaire</span>
          </div>
          <div className="ml-auto z-10 flex gap-4 text-xs text-gray-500">
            <button onClick={showHint} disabled={hintsLeft === 0} className="hover:text-white transition-colors uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Hint ({hintsLeft})</button>
            <button onClick={startNewGame} className="hover:text-white transition-colors uppercase cursor-pointer">Restart</button>
            <span>Moves: {moveCount}</span>
          </div>
        </div>
      )}

      <div className={`flex-1 ${isMobile ? 'px-2 pt-6 pb-2' : 'p-6 sm:p-10'} flex flex-col relative overflow-y-auto transition-all duration-300 ${noMoves && !hasWon ? 'grayscale opacity-40 pointer-events-none' : ''} ${hasWon ? 'pointer-events-none' : ''}`} onClick={() => setSelected(null)}>
        <div ref={boardInnerRef} className="w-full mx-auto flex flex-col flex-1 min-h-0" style={{ maxWidth: isMobile ? '100%' : DESKTOP_BOARD_W }}>
        <div className={`flex justify-around items-start ${isMobile ? 'mb-4' : 'mb-12'} flex-shrink-0`}>
          {/* col 1: stock */}
          <div
            style={{ width: 'var(--cw)', height: 'var(--ch)' }}
            className={`border rounded-md cursor-pointer flex items-center justify-center ${stock.length > 0 ? 'striped-bg shadow-lg' : ''} ${hint && hint.from && hint.from.area === 'stock' ? 'border-[#00ff66] ring-2 ring-[#00ff66] z-20' : stock.length > 0 ? 'border-white' : 'border-gray-600/50'}`}
            onClick={handleStockClick}
          >
            {stock.length === 0 && (
              <span className="text-white/35 font-mono text-xs select-none">{isMobile ? '↻' : '[R]'}</span>
            )}
          </div>

          {/* col 2: waste */}
          <div className="relative" style={{ width: 'var(--cw)', height: 'var(--ch)' }}>
            {waste.length === 0 || isDragging('waste', 0, waste.length - 1) ? (
              <Card isEmptyPlaceholder={true} onClick={() => handleEmptyPileClick('waste', 0)} />
            ) : (
              <Card
                card={waste[waste.length - 1]}
                onClick={(e) => handleCardClick(e, 'waste', 0, waste.length - 1)}
                onDoubleClick={(e) => handleDoubleClick(e, 'waste', 0, waste.length - 1)}
                onPointerDown={(e) => handlePointerDown(e, 'waste', 0, waste.length - 1)}
                isSelected={isCardSelected('waste', 0, waste.length - 1)}
                showCursor={isSelectionHead('waste', 0, waste.length - 1)}
                isHint={isHintFrom('waste', 0, waste.length - 1)}
              />
            )}
          </div>

          {/* col 3: spacer to align foundations with tableau columns 4-7 */}
          <div style={{ width: 'var(--cw)', height: 'var(--ch)' }} aria-hidden="true" />

          {/* cols 4-7: foundations */}
          {foundations.map((foundation, index) => (
            <div key={`foundation-${index}`} ref={(el) => (foundationRefs.current[index] = el)} data-drop={`foundation:${index}`} className="relative" style={{ width: 'var(--cw)', height: 'var(--ch)' }}>
              {foundation.length === 0 || isDragging('foundation', index, foundation.length - 1) ? (
                <Card isEmptyPlaceholder={true} isHint={isHintTo('foundation', index)} onClick={() => handleEmptyPileClick('foundation', index)} />
              ) : (
                <Card
                  card={foundation[foundation.length - 1]}
                  onClick={(e) => handleCardClick(e, 'foundation', index, foundation.length - 1)}
                  onPointerDown={(e) => handlePointerDown(e, 'foundation', index, foundation.length - 1)}
                  isSelected={isCardSelected('foundation', index, foundation.length - 1)}
                  showCursor={isSelectionHead('foundation', index, foundation.length - 1)}
                  isHint={isHintTo('foundation', index)}
                />
              )}
            </div>
          ))}
        </div>

        <div ref={tableauRef} className={`flex justify-around flex-1 ${isMobile ? 'overflow-x-hidden pt-2 pb-2' : 'overflow-x-auto pt-4 pb-10'}`}>
          {tableaus.map((tableau, tIndex) => (
            <div key={`tableau-${tIndex}`} data-drop={`tableau:${tIndex}`} className="relative flex flex-col flex-shrink-0" style={{ width: 'var(--cw)', minHeight: cardH }}>
              {tableau.length === 0 || (drag && drag.source.area === 'tableau' && drag.source.index === tIndex && drag.source.cardIndex === 0) ? (
                <Card isEmptyPlaceholder={true} isHint={isHintTo('tableau', tIndex)} onClick={() => handleEmptyPileClick('tableau', tIndex)} />
              ) : (
                tableau.map((card, cIndex) => (
                  <div
                    key={card.id}
                    style={{
                      position: cIndex === 0 ? 'relative' : 'absolute',
                      top: cIndex === 0 ? '0' : `${cIndex * fanFor(tableau.length)}px`,
                      zIndex: cIndex
                    }}
                  >
                    <Card
                      card={card}
                      onClick={(e) => handleCardClick(e, 'tableau', tIndex, cIndex)}
                      onDoubleClick={(e) => handleDoubleClick(e, 'tableau', tIndex, cIndex)}
                      onPointerDown={(e) => handlePointerDown(e, 'tableau', tIndex, cIndex)}
                      isSelected={isCardSelected('tableau', tIndex, cIndex)}
                      showCursor={isSelectionHead('tableau', tIndex, cIndex)}
                      isHint={isHintFrom('tableau', tIndex, cIndex) || (isHintTo('tableau', tIndex) && cIndex === tableau.length - 1)}
                      isDragging={isDragging('tableau', tIndex, cIndex)}
                    />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
        </div>
      </div>

      {hasWon && (
        <canvas
          ref={winCanvasRef}
          className="absolute left-0 w-full z-40 pointer-events-none"
          style={{ top: headerH, height: `calc(100% - ${headerH}px)` }}
        />
      )}

      {(hasWon || noMoves) && (
        <div
          ref={winPanelRef}
          onClick={dismissPanel}
          className={`terminal-panel ${panelExiting ? 'panel-exit' : ''} absolute bottom-0 left-0 right-0 z-50 bg-[#181818] border-t border-[#2d2d2d] font-mono text-xs cursor-pointer`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-4 px-4 h-7 border-b border-gray-800 text-[11px] uppercase tracking-wider">
            <span className="text-gray-200">Terminal</span>
            <span className="ml-auto normal-case text-gray-600">{hasWon ? 'zsh — exit 0' : 'zsh — exit 1'}</span>
          </div>
          <div className="px-4 py-3 leading-relaxed">
            {hasWon ? (
              <>
                <p className="text-[#00ff66]">solitaire: all 52 cards sorted</p>
                <p className="text-[#00ff66]">solitaire: you win</p>
                <p className="text-gray-500">exit status 0 · {moveCount} moves</p>
                <p className="mt-2 text-gray-300">{isMobile ? 'tap to play again' : 'press [ENTER] to play again'}<span className="prompt-cursor" /></p>
              </>
            ) : (
              <>
                <p className="text-[#ff5555]">solitaire: no legal moves remaining</p>
                <p className="text-[#ff5555]">solitaire: deadlock — cannot continue</p>
                <p className="text-gray-500">exit status 1 · {moveCount} moves</p>
                <p className="mt-2 text-gray-300">{isMobile ? 'tap to restart' : 'press [ENTER] to restart'}<span className="prompt-cursor" /></p>
              </>
            )}
          </div>
        </div>
      )}

      {drag && (
        <div ref={floatRef} className="fixed z-[60] pointer-events-none" style={{ left: drag.x, top: drag.y }}>
          {drag.cards.map((card, i) => (
            <div key={card.id} style={{ position: i === 0 ? 'relative' : 'absolute', top: i === 0 ? 0 : `${i * drag.fan}px`, left: 0 }}>
              <Card card={card} />
            </div>
          ))}
        </div>
      )}

      {isMobile && isLandscape && (
        <div
          className="fixed inset-0 z-[70] terminal-bg flex flex-col items-center justify-center gap-3 text-center px-8"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <span className="text-5xl text-[#00ff66]" style={{ animation: 'spin 2.4s linear infinite' }}>↻</span>
          <p className="font-mono text-gray-300 text-sm">rotate to portrait</p>
          <p className="font-mono text-gray-600 text-xs">solitaire needs a taller screen</p>
        </div>
      )}
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap';
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.textContent = `
      html, body { height: 100%; }
      body { background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('/wallpaper.png') center / cover no-repeat fixed; color: #e0e0e0; margin: 0; overflow: hidden; overscroll-behavior: none; -webkit-touch-callout: none; touch-action: manipulation; font-family: 'Fira Code', monospace; -webkit-tap-highlight-color: transparent; }
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
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(fontLink);
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 sm:p-8 overflow-hidden">
      <TerminalSolitaire />
    </div>
  );
};

export default App;