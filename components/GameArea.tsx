
import React, { useState, useEffect, useRef } from 'react';
import { Game, GameMode, PlayMode } from '../types';
import { useCoinSystem } from '../context/CoinContext';
import GameAtmosphere3D from './GameAtmosphere3D';
import { recordSiteEvent } from '../lib/analytics';


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

  const shareGame = async () => {
    const url = `${window.location.origin}${window.location.pathname}?game=${encodeURIComponent(selectedGame.id)}`;
    const shareData = { title: `${selectedGame.label} · Arcade Hub`, text: `Play ${selectedGame.label} at Arcade Hub`, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(url);
      void recordSiteEvent('share_clicked', selectedGame.id);
      setFeedback(navigator.share ? 'Shared!' : 'Game link copied!');
    } catch {
      setFeedback('Share cancelled');
    }
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
  const stageAccent = equippedAesthetic?.accentColor ?? (mode === GameMode.Adult ? (currencyMode === 'fun' ? '#f2c94c' : '#51d27c') : playMode === 'vsPlayer' ? '#e7bd4a' : '#b68ee8');
  const stagePanelFrom = mode === GameMode.Adult ? (currencyMode === 'fun' ? '#211b12' : '#102019') : playMode === 'vsPlayer' ? '#111827' : '#191329';
  const stagePanelTo = mode === GameMode.Adult ? (currencyMode === 'fun' ? '#0e0c09' : '#08100c') : '#080b12';
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
      <div className="game-picker-row mb-3 w-full max-w-7xl">
      <label className="game-picker-mobile w-full max-w-md md:hidden">
        <span>CHOOSE GAME</span>
        <select
          aria-label="Choose a game"
          value={selectedGame.id}
          onChange={(event) => {
            const game = games.find((candidate) => candidate.id === event.target.value);
            if (game) handleSelectGame(game);
          }}
        >
          {games.map((game) => <option key={game.id} value={game.id}>{game.label}</option>)}
        </select>
      </label>
      <nav className="hidden w-full max-w-7xl flex-wrap justify-center gap-1.5 pb-1 mb-3 md:flex" aria-label="Choose a game">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => handleSelectGame(game)}
            className={`shrink-0 text-xs md:text-sm bg-gray-800 text-yellow-400 border-none py-1.5 px-3 md:px-4 rounded-xl cursor-pointer shadow-md shadow-yellow-400/20 transition-all duration-200 ${
              selectedGame.id === game.id
                ? 'bg-yellow-400 text-gray-800 shadow-lg shadow-yellow-400/40 scale-105'
                : 'hover:bg-yellow-400/80 hover:text-gray-800 hover:shadow-lg hover:shadow-yellow-400/40'
            }`}
          >
            {game.label}
          </button>
        ))}
      </nav>
      <button type="button" className="game-share-button" onClick={() => void shareGame()} aria-label={`Share ${selectedGame.label}`}>↗ Share {selectedGame.label}</button>
      </div>
      
      {/* Game Options */}
      <div className="mb-4 h-auto min-h-[34px] flex flex-col items-center justify-center gap-2">
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
          className={`game-content-layer relative z-10 w-full ${activeNeedsNaturalHeight ? 'min-h-[420px] h-auto justify-start' : 'h-full justify-center'} flex flex-col items-center ${previousGameProps ? 'game-transition-in' : ''}`}
          style={{
            paddingBlock: 'var(--game-area-padding-y)',
            paddingInline: activeGameProps.game.id === 'fishing' ? 'clamp(0rem, 1vw, .75rem)' : activeGameProps.game.id === 'slots' || activeGameProps.game.id === 'mancala' ? 'clamp(.35rem, 2vw, 1rem)' : 'var(--game-area-padding-x)',
            '--stage-accent': stageAccent,
            '--stage-panel-from': stagePanelFrom,
            '--stage-panel-to': stagePanelTo,
          } as React.CSSProperties}
        >
            <ActiveGameComponent 
                key={activeGameProps.game.id + (activeGameProps.mode === GameMode.Under18 ? activeGameProps.playMode : activeGameProps.currencyMode)} 
                {...activeGameProps}
            />
        </div>
      </div>
      <style>{`
        .game-picker-row{display:flex;align-items:center;justify-content:center;gap:8px}.game-picker-mobile{position:relative;display:grid;gap:4px}.game-picker-mobile span{padding-left:4px;color:#d5b544;font-size:8px;font-weight:950;letter-spacing:.18em}.game-picker-mobile select{width:100%;min-height:44px;padding:0 42px 0 14px;border:1px solid #8a7228;border-radius:12px;appearance:none;background:linear-gradient(145deg,#253040,#111822);box-shadow:0 8px 20px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.08);color:#ffd84f;font-size:15px;font-weight:900}.game-picker-mobile:after{content:'▾';position:absolute;right:15px;bottom:10px;color:#ffd84f;pointer-events:none}.game-share-button{align-self:flex-end;min-height:40px;padding:0 13px;border:1px solid #4c7190;border-radius:10px;background:#13283a;color:#bfeaff;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.game-share-button:hover{border-color:#ffd84f;color:#ffe37b}@media(min-width:768px){.game-picker-mobile{display:none}}@media(max-width:767px){.game-picker-row{align-items:stretch}.game-share-button{align-self:end;min-height:44px;padding-inline:10px;font-size:10px}.game-picker-mobile{flex:1}}
        .game-engine-stage{isolation:isolate;perspective:1400px;transform-style:preserve-3d}
        .game-content-layer{border-radius:inherit;background:radial-gradient(circle at 50% -12%,color-mix(in srgb,var(--stage-accent) 18%,transparent),transparent 46%),linear-gradient(145deg,var(--stage-panel-from),var(--stage-panel-to));box-shadow:inset 0 1px color-mix(in srgb,var(--stage-accent) 18%,transparent)}
        .game-content-layer :where(.volt-slots,.wheel-game,.coin-pusher-game,.crash-game,.color-recall-game,.holdem-game,.online-table-game,.ocean-hunter){background:radial-gradient(circle at 50% -10%,color-mix(in srgb,var(--stage-accent) 14%,transparent),transparent 44%),linear-gradient(145deg,color-mix(in srgb,var(--stage-panel-from) 86%,transparent),color-mix(in srgb,var(--stage-panel-to) 88%,transparent))!important;border-color:color-mix(in srgb,var(--stage-accent) 42%,#394451)!important}
        .game-engine-stage:after{content:'';position:absolute;z-index:2;inset:0;pointer-events:none;border-radius:inherit;background:radial-gradient(circle at 50% 0%,rgba(115,224,255,.08),transparent 42%),linear-gradient(115deg,transparent 25%,rgba(255,255,255,.025) 42%,transparent 58%);mix-blend-mode:screen;animation:engine-light-sweep 9s ease-in-out infinite}
        .game-engine-stage canvas{contain:strict;transform:translateZ(0);backface-visibility:hidden;will-change:transform,filter;filter:saturate(1.12) contrast(1.035);transition:filter .45s cubic-bezier(.2,.75,.25,1)}
        .game-content-layer :where(.poker-table,.online-felt,.volt-machine,.coin-pusher-machine,.mancala-board,.crash-stage,.wheel-glass,.color-recall-stage){transform:translateZ(0);backface-visibility:hidden;will-change:transform,filter;transition:border-color .35s ease,box-shadow .45s ease,background-color .45s ease}
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
        @media(prefers-reduced-motion:reduce){.game-engine-stage:after,.game-engine-stage *{scroll-behavior:auto!important}.game-engine-stage :where(.poker-table,.volt-machine,.coin-pusher-machine,.wheel-glass,.color-wheel,.stone-stack-icon,.online-seat,.poker-seat,.holdem-card){animation:none!important;transition-duration:.01ms!important}}
      `}</style>
    </div>
  );
};

export default GameArea;
