import React from 'react';
import { PlayMode } from '../types';

interface PlayerNameInputsProps {
  playMode: PlayMode;
  names: { player1: string; player2: string };
  onNameChange: React.Dispatch<React.SetStateAction<{ player1: string; player2: string }>>;
}

const PlayerNameInputs: React.FC<PlayerNameInputsProps> = ({ playMode, names, onNameChange }) => {

  const handleNameChange = (player: 'player1' | 'player2', newName: string) => {
    onNameChange(prev => ({ ...prev, [player]: newName }));
  };
  
  const opponentName = playMode === 'vsPlayer' ? 'Player 2' : 'Computer';

  return (
    <div className="leather-board rounded-lg p-3 w-full max-w-lg">
      <h3 className="text-center text-xl mb-2">Player Setup</h3>
      <div className="flex justify-around items-center gap-4">
        <div className="flex-1 flex flex-col items-center">
          <label htmlFor="player1-name" className="font-semibold text-sm mb-1">Player 1 (X)</label>
          <input
            id="player1-name"
            type="text"
            value={names.player1}
            onChange={(e) => handleNameChange('player1', e.target.value)}
            className="w-full text-center rounded p-1 text-base"
          />
        </div>
        <div className="text-2xl font-bold">VS</div>
        <div className="flex-1 flex flex-col items-center">
          <label htmlFor="player2-name" className="font-semibold text-sm mb-1">{opponentName} (O)</label>
          {playMode === 'vsPlayer' ? (
            <input
              id="player2-name"
              type="text"
              value={names.player2}
              onChange={(e) => handleNameChange('player2', e.target.value)}
              className="w-full text-center rounded p-1 text-base"
            />
          ) : (
            <div className="w-full text-center rounded p-1 text-base bg-black/30 h-[34px] flex items-center justify-center">
              Computer
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerNameInputs;