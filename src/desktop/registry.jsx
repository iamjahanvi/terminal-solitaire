import { SolitaireGame } from '../../react-app.jsx';
import { SudokuGame } from '../../sudoku-app.jsx';
import { SolitaireIcon, SudokuIcon } from './icons.jsx';

// One entry per game. Adding a game = add a row here (drives the dock, the mobile
// home screen, routing, and window creation).
export const GAMES = [
  { id: 'solitaire', title: 'Solitaire', Icon: SolitaireIcon, width: 960, height: 800, Component: SolitaireGame },
  { id: 'sudoku',    title: 'Sudoku',    Icon: SudokuIcon,    width: 960, height: 800, Component: SudokuGame },
];

export const getGame = (id) => GAMES.find((g) => g.id === id);
