
// constants.tsx v0.0.40 - Lazy Game Registry
import React from 'react';
import { Game } from './types';

const PlinkoGame = React.lazy(() => import('./components/games/PlinkoGame'));
const ChutesAndLaddersGame = React.lazy(() => import('./components/games/ChutesAndLaddersGame'));
const BlockDropGame = React.lazy(() => import('./components/games/BlockDropGame'));
const FishingGame = React.lazy(() => import('./components/games/FishingGame'));
const JetPilotGame = React.lazy(() => import('./components/games/JetPilotGame'));
const SlotsGame = React.lazy(() => import('./components/games/SlotsGame'));
const MancalaGame = React.lazy(() => import('./components/games/MancalaGame'));
const WhackAttack3D = React.lazy(() => import('./components/games/WhackAttack3D'));
const NeonHopperGame = React.lazy(() => import('./components/games/NeonHopperGame'));
const KongClimberGame = React.lazy(() => import('./components/games/KongClimberGame'));

export const APP_VERSION = '0.0.41';

export const ADULT_GAMES: Game[] = [
    { id: 'fishing', label: 'Ocean Hunter', component: FishingGame },
    { id: 'whackattack', label: 'Whack Attack 3D', component: WhackAttack3D },
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
