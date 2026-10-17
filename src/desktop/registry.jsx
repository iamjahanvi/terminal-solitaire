import { SolitaireGame } from '../../react-app.jsx';
import { SudokuGame } from '../../sudoku-app.jsx';
import { SolitaireIcon, SudokuIcon, TetrisIcon } from './icons.jsx';

// One entry per game. Adding a game = add a row here (drives the dock, the mobile
// home screen, routing, and window creation).
export const GAMES = [
  { id: 'solitaire', title: 'Solitaire', Icon: SolitaireIcon, width: 960, height: 800, Component: SolitaireGame },
  { id: 'sudoku',    title: 'Sudoku',    Icon: SudokuIcon,    width: 960, height: 800, Component: SudokuGame },
];

// Teased in the dock only (disabled, "coming soon" tooltip). Kept out of GAMES so
// routing, the command line and the mobile home screen never try to open them.
export const COMING_SOON = [
  { id: 'tetris', title: 'Tetris', Icon: TetrisIcon },
];

export const getGame = (id) => GAMES.find((g) => g.id === id);
