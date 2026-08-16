
// constants.tsx v0.0.28 - Lazy Game Registry
import React from 'react';
import { Game } from './types';

const KenoGame = React.lazy(() => import('./components/games/KenoGame'));
const PlinkoGame = React.lazy(() => import('./components/games/PlinkoGame'));
const WormGame = React.lazy(() => import('./components/games/WormGame'));
const ConnectFourGame = React.lazy(() => import('./components/games/ConnectFourGame'));
const FishingGame = React.lazy(() => import('./components/games/FishingGame'));
const ColorRecallGame = React.lazy(() => import('./components/games/ColorRecallGame'));
const CrashGame = React.lazy(() => import('./components/games/CrashGame'));
const SlotsGame = React.lazy(() => import('./components/games/SlotsGame'));
const MancalaGame = React.lazy(() => import('./components/games/MancalaGame'));
const BlackjackGame = React.lazy(() => import('./components/games/BlackjackGame'));
const TexasHoldemLobby = React.lazy(() => import('./components/games/TexasHoldemLobby'));
const SpinWheelGame = React.lazy(() => import('./components/games/SpinWheelGame'));
const CoinPusherGame = React.lazy(() => import('./components/games/CoinPusherGame'));
const RPSCardGame = React.lazy(() => import('./components/games/RPSCardGame'));
const TicTacToeGame = React.lazy(() => import('./components/games/TicTacToeGame'));

export const APP_VERSION = '0.0.28';

export const ADULT_GAMES: Game[] = [
    { id: 'wheel', label: 'Spin Wheel', component: SpinWheelGame },
    { id: 'crash', label: 'Crash', component: CrashGame },
    { id: 'blackjack', label: 'Blackjack', component: BlackjackGame },
    { id: 'poker', label: 'Hold\'em', component: TexasHoldemLobby },
    { id: 'keno', label: 'Keno', component: KenoGame },
    { id: 'plinko', label: 'Plinko', component: PlinkoGame },
    { id: 'slots', label: 'Slots', component: SlotsGame },
    { id: 'fishing', label: 'Ocean Hunter', component: FishingGame },
    { id: 'coinpusher', label: 'Coin Pusher', component: CoinPusherGame },
];

export const UNDER18_GAMES: Game[] = [
    { id: 'worm', label: 'Worm.io', component: WormGame },
    { id: 'connect4', label: 'Connect Four', component: ConnectFourGame },
    { id: 'rubikscube', label: 'Color Recall', component: ColorRecallGame },
    { id: 'mancala', label: 'Mancala', component: MancalaGame },
    { id: 'rps', label: 'RPS Cards', component: RPSCardGame },
    { id: 'tictactoe', label: 'Tic Tac Toe', component: TicTacToeGame },
];
