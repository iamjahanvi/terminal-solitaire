import React, { useEffect, useRef, useState } from 'react';
import { allWins, streak, bestSolitaire, bestSudoku } from './stats.js';

// Desktop "files" in the top-right corner. They open in ordinary windows (see
// Desktop.jsx) alongside a game rather than replacing it.

// ── icons (viewBox 0..48 × 0..56) ─────────────────────────────────────────────
const DocIcon = ({ label, color }) => (
  <svg viewBox="0 0 48 56" width="100%" height="100%" aria-hidden="true">
    <path d="M6 2h25l11 11v39a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#f3f4f6" />
    <path d="M31 2v9a2 2 0 0 0 2 2h9z" fill="#c9ccd1" />
    <g stroke="#d4d7dc" strokeWidth="1.6"><line x1="10" y1="20" x2="36" y2="20" /><line x1="10" y1="44" x2="36" y2="44" /><line x1="10" y1="48" x2="28" y2="48" /></g>
    <rect x="9" y="26" width="30" height="13" rx="2.5" fill="#1e1e1e" />
    <text x="24" y="35.6" textAnchor="middle" fontFamily="'Fira Code', monospace" fontSize="9" fontWeight="700" fill={color}>{label}</text>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 48 56" width="100%" height="100%" aria-hidden="true">
    <rect x="7" y="9" width="34" height="5" rx="2" fill="#d1d5db" />
    <rect x="19" y="5" width="10" height="5" rx="1.5" fill="none" stroke="#d1d5db" strokeWidth="2" />
    <path d="M10 16h28l-2.6 34a3 3 0 0 1-3 2.8H15.6a3 3 0 0 1-3-2.8z" fill="rgba(229,231,235,0.55)" stroke="#e5e7eb" strokeWidth="1.5" />
    <g stroke="rgba(30,30,30,0.45)" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="22" x2="18.8" y2="46" /><line x1="24" y1="22" x2="24" y2="46" /><line x1="30" y1="22" x2="29.2" y2="46" /></g>
  </svg>
);

// ── contents ──────────────────────────────────────────────────────────────────
const Pane = ({ children }) => (
  <div className="h-full overflow-auto px-6 py-5 font-mono text-[13.5px] leading-relaxed text-gray-300 whitespace-pre-wrap select-text">{children}</div>
);
const H = ({ children }) => <span className="text-[#00ff66]">{children}</span>;
const Dim = ({ children }) => <span className="text-gray-500">{children}</span>;

const Readme = () => (
  <Pane>
    <H>TERMINAL ARCADE</H>{'\n'}<Dim>===============</Dim>{'\n'}
    a tiny arcade that lives in your browser.{'\n\n'}
    <H>GAMES</H>{'\n'}
    {'  '}solitaire   klondike. stack down, alternate colours{'\n'}
    {'  '}sudoku      easy, medium or hard{'\n'}
    {'  '}tetris      coming soon. the cat is excited{'\n\n'}
    <H>SOLITAIRE KEYS</H>{'\n'}
    {'  '}arrows      move the cursor{'\n'}
    {'  '}enter       pick up / put down{'\n'}
    {'  '}f           send a card to the foundation{'\n'}
    {'  '}r           draw from the stock{'\n\n'}
    <H>SUDOKU KEYS</H>{'\n'}
    {'  '}arrows      move around the grid{'\n'}
    {'  '}1-9         fill a cell{'\n'}
    {'  '}0 / ⌫       clear a cell{'\n\n'}
    <H>ANYWHERE IN A GAME</H>{'\n'}
    {'  '}/           open the command line to switch games{'\n\n'}
    <H>THE CAT</H>{'\n'}
    {'  '}click it. it knows your scores.{'\n'}
    {'  '}don't click it too much.
  </Pane>
);

const pad2 = (n) => String(n).padStart(2, '0');
const stamp = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const mmss = (s) => `${Math.floor(s / 60)}:${pad2(s % 60)}`;

const ScoresLog = () => {
  const wins = allWins();
  const end = useRef(null);
  useEffect(() => { end.current && end.current.scrollIntoView({ block: 'end' }); }, []);
  const sol = bestSolitaire(), sud = bestSudoku(), n = streak();
  return (
    <Pane>
      <Dim># scores.log: every win in this browser, newest last</Dim>{'\n\n'}
      {wins.length === 0 && <><Dim>[{stamp(Date.now())}]</Dim> no entries yet. go win something.{'\n'}</>}
      {wins.map((w, i) => (
        <React.Fragment key={i}>
          <Dim>[{stamp(w.at)}]</Dim> <H>WIN</H>  {w.game.padEnd(10)} {w.game === 'solitaire' ? `${w.moves} moves` : `${mmss(w.seconds)}  ${w.difficulty}`}{'\n'}
        </React.Fragment>
      ))}
      {wins.length > 0 && <>{'\n'}<Dim>-- {wins.length} win{wins.length > 1 ? 's' : ''}{n ? ` · ${n}-day streak` : ''}{sol ? ` · best solitaire ${sol} moves` : ''}{sud ? ` · fastest sudoku ${mmss(sud.seconds)} (${sud.difficulty})` : ''}</Dim>{'\n'}</>}
      <span ref={end} />
    </Pane>
  );
};

const TRASH_KEY = 'arcade-trash-emptied';
const JUNK = [
  ['tetris_v0.1_final_FINAL.js', 'it was not final'],
  ['my_losing_streak.txt', "we don't talk about it"],
  ['draw_three_mode.cfg', 'too hard. deleted'],
  ['sudoku_answers_DO_NOT_OPEN.txt', 'nice try'],
  ['hairball.ascii', 'the cat did this'],
];

const Trash = () => {
  const [empty, setEmpty] = useState(() => { try { return localStorage.getItem(TRASH_KEY) === '1'; } catch { return false; } });
  const emptyTrash = () => {
    setEmpty(true);
    try { localStorage.setItem(TRASH_KEY, '1'); } catch { /* storage unavailable */ }
  };
  return (
    <Pane>
      {empty ? (
        <><Dim>$ ls ~/.Trash</Dim>{'\n\n'}trash is empty.{'\n'}<Dim>(the cat ate the hairball. don't ask)</Dim></>
      ) : (
        <>
          <Dim>$ ls ~/.Trash</Dim>{'\n\n'}
          {JUNK.map(([name, note]) => <React.Fragment key={name}>{'  '}{name.padEnd(32)}<Dim># {note}</Dim>{'\n'}</React.Fragment>)}
          {'\n'}
          <button type="button" onClick={emptyTrash} className="px-3 py-1 rounded border border-[#ff5555] text-[#ff5555] hover:bg-[#ff5555] hover:text-black transition-colors">Empty Trash</button>
        </>
      )}
    </Pane>
  );
};

export const FILES = [
  { id: 'readme', title: 'README.txt', Icon: () => <DocIcon label="TXT" color="#60a5fa" />, width: 620, height: 600, Component: Readme },
  { id: 'scores', title: 'scores.log', Icon: () => <DocIcon label="LOG" color="#00ff66" />, width: 680, height: 460, Component: ScoresLog },
  { id: 'trash',  title: 'Trash',      Icon: TrashIcon,                                     width: 680, height: 380, Component: Trash },
];

// The column of icons. Click selects (focus), double-click or Enter opens.
export const DesktopFiles = ({ onOpen }) => (
  <div className="desk-files">
    {FILES.map((f) => (
      <button
        key={f.id}
        type="button"
        className="desk-file"
        onDoubleClick={() => onOpen(f.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(f.id); } }}
        aria-label={`${f.title}: double-click to open`}
      >
        <span className="desk-file-icon"><f.Icon /></span>
        <span className="desk-file-name">{f.title}</span>
      </button>
    ))}
  </div>
);
