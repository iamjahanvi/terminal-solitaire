// Tiny local record of finished games, so the desktop cat can talk about your
// streak and bests. Lives in this browser only (localStorage); every access is
// wrapped because storage can be blocked (private mode, disabled site data).
const KEY = 'arcade-stats-v1';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || { wins: [] }; } catch { return { wins: [] }; }
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// game: 'solitaire' | 'sudoku'; detail: { moves } or { seconds, difficulty }
export function recordWin(game, detail) {
  const s = load();
  s.wins.push({ game, at: Date.now(), ...detail });
  s.wins = s.wins.slice(-500);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

// Consecutive days with at least one win, counting back from today (or from
// yesterday, so the streak doesn't read 0 before you've played today).
export function streak() {
  const days = new Set(load().wins.map((w) => dayKey(new Date(w.at))));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function playedToday() {
  const today = dayKey(new Date());
  return load().wins.some((w) => dayKey(new Date(w.at)) === today);
}

export function bestSolitaire() {
  const m = load().wins.filter((w) => w.game === 'solitaire' && w.moves > 0).map((w) => w.moves);
  return m.length ? Math.min(...m) : null;
}

export function bestSudoku() {
  let best = null;
  load().wins.forEach((w) => {
    if (w.game === 'sudoku' && w.seconds > 0 && (!best || w.seconds < best.seconds)) best = w;
  });
  return best;
}

export function winCount(game) {
  return load().wins.filter((w) => !game || w.game === game).length;
}

export function allWins() {
  return load().wins;
}
