
// constants.tsx v0.0.36 - Lazy Game Registry
import React from 'react';
import { Game } from './types';

const KenoGame = React.lazy(() => import('./components/games/KenoGame'));
const PlinkoGame = React.lazy(() => import('./components/games/PlinkoGame'));
const NimGame = React.lazy(() => import('./components/games/NimGame'));
const ChutesAndLaddersGame = React.lazy(() => import('./components/games/ChutesAndLaddersGame'));
const BlockDropGame = React.lazy(() => import('./components/games/BlockDropGame'));
const ConnectFourGame = React.lazy(() => import('./components/games/ConnectFourGame'));
const FishingGame = React.lazy(() => import('./components/games/FishingGame'));
const ColorRecallGame = React.lazy(() => import('./components/games/ColorRecallGame'));
const JetPilotGame = React.lazy(() => import('./components/games/JetPilotGame'));
const SlotsGame = React.lazy(() => import('./components/games/SlotsGame'));
const MancalaGame = React.lazy(() => import('./components/games/MancalaGame'));
const BlackjackGame = React.lazy(() => import('./components/games/BlackjackGame'));
const TexasHoldemLobby = React.lazy(() => import('./components/games/TexasHoldemLobby'));
const SpinWheelGame = React.lazy(() => import('./components/games/SpinWheelGame'));
const CoinPusherGame = React.lazy(() => import('./components/games/CoinPusherGame'));
const NeonHopperGame = React.lazy(() => import('./components/games/NeonHopperGame'));
const KongClimberGame = React.lazy(() => import('./components/games/KongClimberGame'));

export const APP_VERSION = '0.0.38';

export const ADULT_GAMES: Game[] = [
    { id: 'fishing', label: 'Ocean Hunter', component: FishingGame },
    { id: 'coinpusher', label: 'Coin Pusher 3D', component: CoinPusherGame },
    { id: 'jetpilot', label: 'Jet Pilot Lander', component: JetPilotGame },
    { id: 'plinko', label: 'Peg Plinko', component: PlinkoGame },
    { id: 'slots', label: 'Volt Vault Slots', component: SlotsGame },
];

export const UNDER18_GAMES: Game[] = [
    { id: 'neonhopper', label: 'Neon Hopper', component: NeonHopperGame },
    { id: 'kongclimber', label: 'Kong Climber', component: KongClimberGame },
    { id: 'blockdrop', label: 'Block Drop', component: BlockDropGame },
    { id: 'mancala', label: 'Mancala 3D', component: MancalaGame },
    { id: 'chutes', label: 'Chutes & Ladders', component: ChutesAndLaddersGame },
];
