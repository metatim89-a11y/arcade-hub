
import React, { useState, useEffect, useRef } from 'react';
import { Game, GameMode, PlayMode } from '../types';
import { useCoinSystem } from '../context/CoinContext';
import GameAtmosphere3D from './GameAtmosphere3D';


const GameOptionsSelector: React.FC<{
  mode: GameMode;
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
}> = ({ mode, playMode, setPlayMode }) => {
  const { currencyMode, setCurrencyMode } = useCoinSystem();

  const buttonClass = "px-4 py-2 rounded-lg text-sm font-semibold transition-colors";
  
  if (mode === GameMode.Under18) {
    const activeClass = "bg-yellow-400 text-gray-900";
    const inactiveClass = "bg-gray-700 text-yellow-400 hover:bg-gray-600";
    return (
      <div className="flex gap-2 p-1 bg-gray-900/50 rounded-lg">
        <button onClick={() => setPlayMode('vsPlayer')} className={`${buttonClass} ${playMode === 'vsPlayer' ? activeClass : inactiveClass}`}>
          VS Player
        </button>
        <button onClick={() => setPlayMode('vsComputer')} className={`${buttonClass} ${playMode === 'vsComputer' ? activeClass : inactiveClass}`}>
          VS Computer
        </button>
      </div>
    );
  }
  
  if (mode === GameMode.Adult) {
     return (
      <div className="flex gap-2 p-1 bg-gray-900/50 rounded-lg">
        <button onClick={() => setCurrencyMode('fun')} className={`${buttonClass} ${currencyMode === 'fun' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-yellow-400 hover:bg-gray-600'}`}>
          Play with Fun Coins
        </button>
        <button onClick={() => setCurrencyMode('real')} className={`${buttonClass} ${currencyMode === 'real' ? 'bg-green-500 text-gray-900' : 'bg-gray-700 text-green-400 hover:bg-gray-600'}`}>
          Play with Virtual RC
        </button>
      </div>
    );
  }

  return null;
}


interface GameAreaProps {
  games: Game[];
  selectedGame: Game;
  onSelectGame: (game: Game) => void;
  mode: GameMode;
}

const GameArea: React.FC<GameAreaProps> = ({ games, selectedGame, onSelectGame, mode }) => {
  const [feedback, setFeedback] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>('vsPlayer');
  const [playerNames, setPlayerNames] = useState({ player1: 'Player 1', player2: 'Player 2' });
  const { currencyMode, aesthetics, equippedAesthetics } = useCoinSystem();

  const gameProps = { game: selectedGame, playMode, currencyMode, mode, playerNames };
  const [activeGameProps, setActiveGameProps] = useState(gameProps);
  const [previousGameProps, setPreviousGameProps] = useState<typeof gameProps | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
    }

    const newKey = selectedGame.id + (mode === GameMode.Under18 ? playMode : currencyMode);
    const oldKey = activeGameProps.game.id + (activeGameProps.mode === GameMode.Under18 ? activeGameProps.playMode : activeGameProps.currencyMode);

    if (newKey !== oldKey) {
        if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
        }

        setPreviousGameProps(activeGameProps);
        setActiveGameProps({ game: selectedGame, playMode, currencyMode, mode, playerNames });

        transitionTimeoutRef.current = window.setTimeout(() => {
            setPreviousGameProps(null);
            transitionTimeoutRef.current = null;
        }, 300); // Animation duration
    } else {
        setActiveGameProps({ game: selectedGame, playMode, currencyMode, mode, playerNames });
    }
  }, [selectedGame, playMode, currencyMode, mode, playerNames]);

  useEffect(() => {
    return () => {
        if (transitionTimeoutRef.current) {
            clearTimeout(transitionTimeoutRef.current);
        }
    };
  }, []);

  const handleSelectGame = (game: Game) => {
    onSelectGame(game);
    setFeedback('');
  };
  
  const gameAreaSizeClass = activeGameProps.game.id === 'fishing'
    ? 'max-w-[1900px]'
    : (activeGameProps.game.id === 'mancala' || activeGameProps.game.id === 'worm') ? 'max-w-7xl' : 'max-w-4xl';

  const themeClasses = (() => {
    if (mode === GameMode.Adult) {
        return currencyMode === 'fun'
            ? 'bg-[#2c2419]/80 shadow-[0_8px_40px_rgba(255,215,0,0.2),0_2px_8px_rgba(210,160,45,0.2)]' // Gold/Brown tint
            : 'bg-[#192c1d]/80 shadow-[0_8px_40px_rgba(100,255,120,0.2),0_2px_8px_rgba(45,182,60,0.2)]'; // Green tint
    } else { // GameMode.Under18
        return playMode === 'vsPlayer'
            ? 'bg-[#191e2c]/80 shadow-[0_8px_40px_rgba(255,215,0,0.26),0_2px_8px_rgba(182,137,45,0.26)]' // Original blue tint
            : 'bg-[#1e192c]/80 shadow-[0_8px_40px_rgba(220,180,255,0.2),0_2px_8px_rgba(160,137,182,0.2)]'; // Purple tint
    }
  })();
  
  const ActiveGameComponent = activeGameProps.game.component;
  const PreviousGameComponent = previousGameProps?.game.component;
  const activeNeedsNaturalHeight = activeGameProps.game.id === 'mancala';
  const equippedAesthetic = aesthetics.find((item) => item.id === equippedAesthetics[activeGameProps.game.id]);
  const aestheticPattern = equippedAesthetic ? (() => {
    switch (equippedAesthetic.visualKey) {
      case 'gold': return `radial-gradient(circle at 50% 0%, ${equippedAesthetic.accentColor}44, transparent 42%), linear-gradient(135deg, ${equippedAesthetic.gradientFrom}, ${equippedAesthetic.gradientTo})`;
      case 'galaxy': return `radial-gradient(circle at 18% 24%, #ffffffaa 0 1px, transparent 2px), radial-gradient(circle at 78% 35%, #ffffff88 0 1px, transparent 2px), linear-gradient(135deg, ${equippedAesthetic.gradientFrom}, ${equippedAesthetic.gradientTo})`;
      case 'ember': return `radial-gradient(circle at 50% 100%, ${equippedAesthetic.accentColor}55, transparent 45%), linear-gradient(145deg, ${equippedAesthetic.gradientFrom}, ${equippedAesthetic.gradientTo})`;
      case 'frost': return `repeating-linear-gradient(120deg, transparent 0 28px, ${equippedAesthetic.accentColor}12 29px 31px), linear-gradient(135deg, ${equippedAesthetic.gradientFrom}, ${equippedAesthetic.gradientTo})`;
      default: return `repeating-linear-gradient(0deg, transparent 0 8px, ${equippedAesthetic.accentColor}12 9px 10px), linear-gradient(135deg, ${equippedAesthetic.gradientFrom}, ${equippedAesthetic.gradientTo})`;
    }
  })() : undefined;

  return (
    <div className={`flex flex-col items-center w-full py-6 md:py-8 ${activeGameProps.game.id === 'fishing' ? 'px-0 sm:px-2' : 'px-4'}`}>
      {/* Game Navigation */}
      <nav className="flex justify-center gap-2 md:gap-4 mb-6 flex-wrap">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => handleSelectGame(game)}
            className={`text-base md:text-lg bg-gray-800 text-yellow-400 border-none py-2 px-5 md:py-2.5 md:px-7 rounded-2xl cursor-pointer shadow-md shadow-yellow-400/20 transition-all duration-200 ${
              selectedGame.id === game.id
                ? 'bg-yellow-400 text-gray-800 shadow-lg shadow-yellow-400/40 scale-105'
                : 'hover:bg-yellow-400/80 hover:text-gray-800 hover:shadow-lg hover:shadow-yellow-400/40'
            }`}
          >
            {game.label}
          </button>
        ))}
      </nav>
      
      {/* Game Options */}
      <div className="mb-6 h-auto min-h-[40px] flex flex-col items-center justify-center gap-4">
        <GameOptionsSelector
          mode={mode}
          playMode={playMode}
          setPlayMode={setPlayMode}
        />
      </div>
      
      {/* Game Canvas */}
      <div 
        data-game={activeGameProps.game.id}
        className={`game-engine-stage w-full ${gameAreaSizeClass} min-h-[420px] rounded-3xl mb-4 ${activeNeedsNaturalHeight ? 'overflow-visible' : 'overflow-hidden'} transition-colors duration-500 relative ${themeClasses}`}
        style={equippedAesthetic ? {
          backgroundImage: aestheticPattern,
          border: `2px solid ${equippedAesthetic.accentColor}`,
          boxShadow: `0 0 34px ${equippedAesthetic.accentColor}66, inset 0 0 28px ${equippedAesthetic.accentColor}18`,
        } : undefined}
      >
        <GameAtmosphere3D gameId={activeGameProps.game.id} />
        {equippedAesthetic && (
          <div className="absolute right-3 top-3 z-20 rounded-full border bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ borderColor: equippedAesthetic.accentColor, color: equippedAesthetic.accentColor }}>
            {equippedAesthetic.name}
          </div>
        )}
        {PreviousGameComponent && previousGameProps && (
            <div 
              className="absolute inset-0 z-10 flex flex-col items-center justify-center game-transition-out"
              style={{
                paddingBlock: 'var(--game-area-padding-y)',
                paddingInline: 'var(--game-area-padding-x)',
              }}
            >
                <PreviousGameComponent
                    key={previousGameProps.game.id + (previousGameProps.mode === GameMode.Under18 ? previousGameProps.playMode : previousGameProps.currencyMode)}
                    {...previousGameProps}
                />
            </div>
        )}

        <div 
          className={`relative z-10 w-full ${activeNeedsNaturalHeight ? 'min-h-[420px] h-auto justify-start' : 'h-full justify-center'} flex flex-col items-center ${previousGameProps ? 'game-transition-in' : ''}`}
          style={{
            paddingBlock: 'var(--game-area-padding-y)',
            paddingInline: activeGameProps.game.id === 'fishing' ? 'clamp(0rem, 1vw, .75rem)' : activeGameProps.game.id === 'slots' || activeGameProps.game.id === 'mancala' ? 'clamp(.35rem, 2vw, 1rem)' : 'var(--game-area-padding-x)',
          }}
        >
            <ActiveGameComponent 
                key={activeGameProps.game.id + (activeGameProps.mode === GameMode.Under18 ? activeGameProps.playMode : activeGameProps.currencyMode)} 
                {...activeGameProps}
            />
        </div>
      </div>
      <style>{`
        .game-engine-stage{isolation:isolate;perspective:1400px;transform-style:preserve-3d}
        .game-engine-stage:after{content:'';position:absolute;z-index:2;inset:0;pointer-events:none;border-radius:inherit;background:radial-gradient(circle at 50% 0%,rgba(115,224,255,.08),transparent 42%),linear-gradient(115deg,transparent 25%,rgba(255,255,255,.025) 42%,transparent 58%);mix-blend-mode:screen;animation:engine-light-sweep 9s ease-in-out infinite}
        .game-engine-stage canvas{filter:saturate(1.12) contrast(1.035);transition:filter .4s ease}
        .game-engine-stage :where(button,[role='button']){transform-style:preserve-3d;transition:transform .18s ease,filter .18s ease,box-shadow .18s ease}
        .game-engine-stage :where(button,[role='button']):not(:disabled):active{transform:translateY(2px) rotateX(-4deg) scale(.98)}
        .game-engine-stage :where(.holdem-card-slot,.card-front,.card-back,.reel-deck,.vault-grid,.stone-stack-icon){transform-style:preserve-3d;backface-visibility:hidden}
        .game-engine-stage :where(.poker-table,.volt-machine,.coin-pusher-machine,.wheel-glass,.color-wheel){filter:drop-shadow(0 18px 28px rgba(0,0,0,.34)) drop-shadow(0 0 16px rgba(88,214,255,.08));animation:engine-stage-breathe 5s ease-in-out infinite}
        .game-engine-stage[data-game='blackjack']>div>div,.game-engine-stage[data-game='poker']>div>div{transform-style:preserve-3d}
        .game-engine-stage[data-game='slots'] .volt-machine{transform:rotateX(1.5deg);transform-origin:50% 100%}
        .game-engine-stage[data-game='connect4'] [class*='rounded-full'],.game-engine-stage[data-game='keno'] button{filter:drop-shadow(0 6px 7px rgba(0,0,0,.34))}
        .game-engine-stage[data-game='mancala'] .stone-stack-icon{filter:drop-shadow(0 5px 5px rgba(0,0,0,.45));animation:engine-token-float 2.8s ease-in-out infinite}
        @keyframes engine-light-sweep{0%,100%{background-position:-40vw 0;opacity:.65}50%{background-position:40vw 0;opacity:1}}
        @keyframes engine-stage-breathe{50%{filter:drop-shadow(0 21px 34px rgba(0,0,0,.4)) drop-shadow(0 0 24px rgba(88,214,255,.15))}}
        @keyframes engine-token-float{50%{transform:translateZ(10px) translateY(-2px)}}
        @media(prefers-reduced-motion:reduce){.game-engine-stage:after,.game-engine-stage :where(.poker-table,.volt-machine,.coin-pusher-machine,.wheel-glass,.color-wheel,.stone-stack-icon){animation:none}}
      `}</style>
    </div>
  );
};

export default GameArea;
