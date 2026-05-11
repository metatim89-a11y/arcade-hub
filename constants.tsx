
// constants.tsx v0.0.11 - Game Registry
import { Game } from './types';
import KenoGame from './components/games/KenoGame';
import PlinkoGame from './components/games/PlinkoGame';
import WormGame from './components/games/WormGame';
import ConnectFourGame from './components/games/ConnectFourGame';
import FishingGame from './components/games/FishingGame';
import RubiksCubeGame from './components/games/RubiksCubeGame';
import CrashGame from './components/games/CrashGame';
import SlotsGame from './components/games/SlotsGame';
import MancalaGame from './components/games/MancalaGame';
import BlackjackGame from './components/games/BlackjackGame';
import TexasHoldemGame from './components/games/TexasHoldemGame';
import SpinWheelGame from './components/games/SpinWheelGame';
import CoinPusherGame from './components/games/CoinPusherGame';
import RPSCardGame from './components/games/RPSCardGame';
import TicTacToeGame from './components/games/TicTacToeGame';

export const APP_VERSION = '0.0.11';

export const ADULT_GAMES: Game[] = [
    { id: 'wheel', label: 'Spin Wheel', component: SpinWheelGame },
    { id: 'crash', label: 'Crash', component: CrashGame },
    { id: 'blackjack', label: 'Blackjack', component: BlackjackGame },
    { id: 'poker', label: 'Hold\'em', component: TexasHoldemGame },
    { id: 'keno', label: 'Keno', component: KenoGame },
    { id: 'plinko', label: 'Plinko', component: PlinkoGame },
    { id: 'slots', label: 'Slots', component: SlotsGame },
    { id: 'fishing', label: 'Ocean Hunter', component: FishingGame },
    { id: 'coinpusher', label: 'Coin Pusher', component: CoinPusherGame },
];

export const UNDER18_GAMES: Game[] = [
    { id: 'worm', label: 'Worm.io', component: WormGame },
    { id: 'connect4', label: 'Connect Four', component: ConnectFourGame },
    { id: 'rubikscube', label: "Rubik's Cube", component: RubiksCubeGame },
    { id: 'mancala', label: 'Mancala', component: MancalaGame },
    { id: 'rps', label: 'RPS Cards', component: RPSCardGame },
    { id: 'tictactoe', label: 'Tic Tac Toe', component: TicTacToeGame },
];
