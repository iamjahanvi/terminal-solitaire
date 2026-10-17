import React from 'react';

// Scalable SVG game icons (viewBox 0..100) so they grow smoothly as the dock
// tile resizes. Drawn in the app palette.

export const SolitaireIcon = (props) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" {...props}>
    {/* back card (red), fanned out */}
    <g transform="rotate(11 62 74)">
      <rect x="44" y="18" width="38" height="56" rx="6" fill="#1e1e1e" stroke="#ff5555" strokeWidth="4" />
    </g>
    {/* front card (white) with A♠ */}
    <rect x="20" y="22" width="38" height="56" rx="6" fill="#1e1e1e" stroke="#e5e7eb" strokeWidth="4" />
    <text x="27" y="41" fontFamily="'Fira Code', monospace" fontSize="17" fill="#e5e7eb">A♠</text>
  </svg>
);

export const SudokuIcon = (props) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" {...props}>
    <rect x="14" y="14" width="72" height="72" rx="8" fill="#1e1e1e" stroke="#9aa0a6" strokeWidth="3.5" />
    <g stroke="rgba(255,255,255,0.2)" strokeWidth="2">
      <line x1="38" y1="14" x2="38" y2="86" />
      <line x1="62" y1="14" x2="62" y2="86" />
      <line x1="14" y1="38" x2="86" y2="38" />
      <line x1="14" y1="62" x2="86" y2="62" />
    </g>
    <g fill="#00ff66" fontFamily="'Fira Code', monospace" fontSize="16" textAnchor="middle">
      <text x="26" y="32">5</text>
      <text x="50" y="56">3</text>
      <text x="74" y="80">8</text>
    </g>
  </svg>
);

// ASCII Tetris, after the 1984 original that drew every block as "[]": a T dropping
// toward a red/white stack. Each row is a 5-column grid ('.' = empty) so blocks line
// up exactly; ligatures are off so Fira Code renders "[]" as two plain glyphs.
const TETRIS_COLORS = { a: '#00ff66', b: '#ff5555', c: '#e5e7eb' };
const TETRIS_ROWS = ['.aaa.', '..a..', '.....', 'b..cc', 'bbcc.'];
const TETRIS_FS = 14;
const TETRIS_X0 = (100 - 5 * TETRIS_FS * 1.2) / 2;

export const TetrisIcon = (props) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" {...props}>
    <g fontFamily="'Fira Code', monospace" fontSize={TETRIS_FS} fontWeight="600" style={{ fontVariantLigatures: 'none', fontFeatureSettings: "'liga' 0, 'calt' 0" }}>
      {TETRIS_ROWS.flatMap((row, r) => [...row].map((k, c) => k === '.' ? null : (
        <text key={`${r}-${c}`} x={TETRIS_X0 + c * TETRIS_FS * 1.2} y={24 + r * 17} fill={TETRIS_COLORS[k]}>[]</text>
      )))}
    </g>
  </svg>
);

// Rounded "app tile" framing an icon. Fills its parent by default (the dock sizes
// it via CSS); pass `size` for a fixed tile (mobile home screen).
export const AppTile = ({ size, children }) => (
  <div
    className="rounded-[24%] flex items-center justify-center overflow-hidden"
    style={{
      width: size || '100%', height: size || '100%',
      background: 'linear-gradient(160deg, #2b2b2b, #161616)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    }}
  >
    {children}
  </div>
);
