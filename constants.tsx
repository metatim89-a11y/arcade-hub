
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

export const ADULT_GAMES: Game[] = [
    { id: 'crash', label: 'Crash', component: CrashGame },
    { id: 'blackjack', label: 'Blackjack', component: BlackjackGame },
    { id: 'poker', label: 'Hold\'em', component: TexasHoldemGame },
    { id: 'keno', label: 'Keno', component: KenoGame },
    { id: 'plinko', label: 'Plinko', component: PlinkoGame },
    { id: 'slots', label: 'Slots', component: SlotsGame },
    { id: 'fishing', label: 'Ocean Hunter', component: FishingGame },
];

export const UNDER18_GAMES: Game[] = [
    { id: 'worm', label: 'Worm.io', component: WormGame },
    { id: 'connect4', label: 'Connect Four', component: ConnectFourGame },
    { id: 'rubikscube', label: "Rubik's Cube", component: RubiksCubeGame },
    { id: 'mancala', label: 'Mancala', component: MancalaGame },
];
