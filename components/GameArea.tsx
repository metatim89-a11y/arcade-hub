
import React, { useState, useEffect, useRef } from 'react';
import { Game, GameMode, PlayMode } from '../types';
import { useCoinSystem } from '../context/CoinContext';
import PlayerNameInputs from './PlayerNameInputs';


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
          Play with Real Coins
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

// Removed 'worm' from this list so it can support vsComputer mode properly
const TWO_PLAYER_GAMES = ['connect4', 'mancala'];

const GameArea: React.FC<GameAreaProps> = ({ games, selectedGame, onSelectGame, mode }) => {
  const [feedback, setFeedback] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>('vsPlayer');
  const [playerNames, setPlayerNames] = useState({ player1: 'Player 1', player2: 'Player 2' });
  const { currencyMode } = useCoinSystem();

  const gameProps = { game: selectedGame, playMode, currencyMode, mode, playerNames };
  const [activeGameProps, setActiveGameProps] = useState(gameProps);
  const [previousGameProps, setPreviousGameProps] = useState<typeof gameProps | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  
  const isTwoPlayerGame = mode === GameMode.Under18 && TWO_PLAYER_GAMES.includes(selectedGame.id);

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
  
  // Added 'fishing' to the wide layout condition
  const gameAreaSizeClass = (activeGameProps.game.id === 'mancala' || activeGameProps.game.id === 'worm' || activeGameProps.game.id === 'fishing') ? 'max-w-7xl' : 'max-w-4xl';

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

  return (
    <div className="flex flex-col items-center w-full px-4 py-6 md:py-8">
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
      
      {/* Game Options / Player Names */}
      <div className="mb-6 h-auto min-h-[40px] flex flex-col items-center justify-center gap-4">
        {isTwoPlayerGame ? (
          <PlayerNameInputs 
            playMode={playMode} 
            names={playerNames} 
            onNameChange={setPlayerNames}
          />
        ) : (
          <GameOptionsSelector 
            mode={mode} 
            playMode={playMode}
            setPlayMode={setPlayMode}
          />
        )}
      </div>
      
      {/* Game Canvas */}
      <div 
        className={`w-full ${gameAreaSizeClass} min-h-[420px] rounded-3xl mb-4 overflow-hidden transition-colors duration-500 relative ${themeClasses}`}
      >
        {PreviousGameComponent && previousGameProps && (
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center game-transition-out"
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
          className={`w-full h-full flex flex-col items-center justify-center ${previousGameProps ? 'game-transition-in' : ''}`}
          style={{
            paddingBlock: 'var(--game-area-padding-y)',
            paddingInline: 'var(--game-area-padding-x)',
          }}
        >
            <ActiveGameComponent 
                key={activeGameProps.game.id + (activeGameProps.mode === GameMode.Under18 ? activeGameProps.playMode : activeGameProps.currencyMode)} 
                {...activeGameProps}
            />
        </div>
      </div>
    </div>
  );
};

export default GameArea;
