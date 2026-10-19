import React, { useEffect, useRef } from 'react';
import { greeting } from './SkyClock.jsx';
import { streak, playedToday, bestSolitaire, bestSudoku, winCount } from './stats.js';

// An ASCII cat on the forest floor of the wallpaper. It walks toward the pointer,
// sits when it catches up and falls asleep after a while without movement (or
// when the pointer leaves the page). Clicking it shows a speech bubble with the
// time or your stats. Positions are written straight to the DOM every frame.
const WALK = [
  ['        /\\_/\\ ', '  ~____( @.@ )', '   (_________) ', '    ||    ||  '],
  ['        /\\_/\\ ', '  ~____( @.@ )', '   (_________) ', '    /\\    /\\  '],
];
const SIT = ['  /\\_/\\  ', ' ( @.@ ) ', '  > ^ <  ', ' (_____)~'];
const SLEEP = ['  /\\_/\\  ', ' ( -.- ) ', '  > ^ <  ', ' (_____)~'];
const MIRROR = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<' };
const flip = (rows) => rows.map((r) => [...r].reverse().map((c) => MIRROR[c] || c).join(''));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toHtml = (rows) => esc(rows.join('\n'))
  .replace(/@/g, '<span class="cat-eye">o</span>')
  .replace(/-\.-/g, '<span class="cat-eye">-</span>.<span class="cat-eye">-</span>');

const WIDTH = 150;     // roughly the walking cat's width, for centering on the pointer
const SPEED = 0.16;    // px per ms
const SLEEP_MS = 6000; // pointer idle this long → nap

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Real facts from your stats. The first click is always the time; after that
// the cat alternates a fact with a joke from QUIPS.
function facts() {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const n = streak();
  const sol = bestSolitaire();
  const sud = bestSudoku();
  const total = winCount();
  return [
    now.getHours() < 5 ? `it's ${time}. one more game, then bed` : `it's ${time}. ${greeting(now)}!`,
    n >= 2 ? `${n}-day streak! keep it going` : playedToday() ? 'you won today. come back tomorrow?' : 'no wins today yet. play a round?',
    sol ? `best solitaire: ${sol} moves${sol < 100 ? '. show-off' : ''}` : "win a solitaire game and i'll remember it",
    sud ? `fastest sudoku: ${fmt(sud.seconds)} (${sud.difficulty})` : 'no sudoku wins yet. i believe in you',
    total >= 10 ? `${total} wins total. i'm impressed` : total ? `${total} win${total > 1 ? 's' : ''} so far. i'm counting` : 'zero wins. no pressure. none at all',
  ];
}

const QUIPS = [
  // solitaire
  'i knocked the ace of spades off the table',
  "kings only go in empty columns. i don't",
  'red on black, black on red. easy',
  'the stock pile is warm. i sleep there now',
  'pro tip: get the aces up top first',
  "i've been sitting on the 7 of hearts all day",
  'one more card. just one. trust me',
  // sudoku
  'sudoku is 81 little boxes. i love boxes',
  'every row needs 1 to 9. every cat needs naps',
  'i have 9 lives. sudoku has 9 digits. hmm',
  'hard mode? i prefer hard naps',
  "pencil marks are just tiny cat scratches",
  // tetris
  'tetris is just boxes falling. my dream game',
  'i tried tetris early. i sat on the keyboard',
  'a long piece is coming. probably. maybe',
  // terminal / cat
  'sudo pet cat',
  '404: treats not found',
  "i'm not lazy, i'm in power-saving mode",
  "have you tried turning the cat off and on?",
  "meow is just 'hello world' in cat",
  "i'm a cat, not a cursor. stop pointing",
  'this laptop is warm. i live here now',
  "ctrl+z won't bring back my nap",
];

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export default function DesktopCat({ hidden }) {
  const catRef = useRef(null);
  const bubRef = useRef(null);
  const zzRef = useRef(null);
  const layerRef = useRef(null);
  const sayRef = useRef(() => {});
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  useEffect(() => {
    let x = window.innerWidth / 2 - 220;
    let target = window.innerWidth / 2;
    let face = 1, state = 'walk', step = 0, stepT = 0, idle = 0, bubT = 0;
    let clicks = 0, fact = 0, bag = [], pets = [];
    let last = 0, frame = 0, drawn = '';

    const onMove = (e) => { target = e.clientX; idle = 0; if (state === 'sleep') state = 'sit'; };
    const onOut = (e) => { if (!e.relatedTarget) target = null; };
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);

    const nextLine = () => {
      const t = performance.now();
      pets = pets.filter((p) => t - p < 3000).concat(t);
      if (state === 'sleep') return Math.random() < 0.5 ? 'mrrp? i was napping' : 'five more minutes…';
      if (pets.length === 6) return "ok ok, that's enough petting";
      if (pets.length > 6) return pets.length > 9 ? "i'm filing a complaint" : 'hmph.';
      const list = facts();
      if (clicks++ === 0) return list[0];
      if (clicks % 2 === 0) return list[1 + (fact++ % (list.length - 1))];
      if (!bag.length) bag = shuffle([...QUIPS]);
      return bag.pop();
    };

    sayRef.current = () => {
      bubRef.current.textContent = nextLine();
      bubT = 2800; idle = 0; state = 'sit';
      for (let i = 0; i < 3; i++) {
        const h = document.createElement('span');
        h.className = 'cat-heart'; h.textContent = '♥';
        h.style.left = `${x + 10 + Math.random() * 70}px`;
        h.style.animationDelay = `${i * 0.15}s`;
        layerRef.current.appendChild(h);
        setTimeout(() => h.remove(), 1700);
      }
    };

    const tick = (t) => {
      const dt = last ? Math.min(t - last, 50) : 16;
      last = t;
      frame = requestAnimationFrame(tick);
      if (hiddenRef.current) return;
      idle += dt; bubT -= dt;
      if (idle > SLEEP_MS) state = 'sleep';
      const home = window.innerWidth / 2 - 100;
      const goal = target == null ? home : target - WIDTH / 2;
      const d = goal - x;
      if (target == null && Math.abs(d) <= 30 && state !== 'sleep' && idle > 2500) state = 'sleep';
      if (state !== 'sleep' && Math.abs(d) > 30) {
        state = 'walk'; face = d > 0 ? 1 : -1;
        x += face * Math.min(Math.abs(d), dt * SPEED);
        stepT += dt; if (stepT > 160) { stepT = 0; step ^= 1; }
      } else if (state === 'walk') state = 'sit';
      x = Math.max(0, Math.min(window.innerWidth - WIDTH, x));

      const rows = state === 'walk' ? WALK[step] : state === 'sit' ? SIT : SLEEP;
      const html = toHtml(face > 0 ? rows : flip(rows));
      if (html !== drawn) { catRef.current.innerHTML = html; drawn = html; }
      catRef.current.style.transform = `translateX(${x}px)`;
      const bx = Math.max(8, Math.min(x, window.innerWidth - bubRef.current.offsetWidth - 8));
      bubRef.current.style.transform = `translateX(${bx}px)`;
      bubRef.current.style.setProperty('--tail', `${x - bx + 22}px`);
      bubRef.current.style.opacity = bubT > 0 ? 1 : 0;
      zzRef.current.style.left = `${x + 80}px`; // left, not transform: the float animation owns transform
      zzRef.current.style.display = state === 'sleep' ? 'block' : 'none';
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
    };
  }, []);

  return (
    <div ref={layerRef} className="cat-layer" style={{ opacity: hidden ? 0 : 1, visibility: hidden ? 'hidden' : 'visible' }}>
      <div ref={bubRef} className="cat-bubble" role="status" aria-live="polite" />
      <div ref={zzRef} className="cat-zz" aria-hidden="true">z Z</div>
      <button ref={catRef} type="button" className="cat" aria-label="Desktop cat: click for your stats" onClick={() => sayRef.current()} />
    </div>
  );
}
