// Hook for game components to report scores during H2H matches
import { useEffect } from 'react';

/**
 * useH2HScoreReporting
 * Hook that game components can use to report their scores during H2H matches
 * 
 * Usage in game component:
 * ```
 * const { reportScore } = useH2HScoreReporting();
 * 
 * // When game score updates:
 * reportScore(newScore);
 * ```
 */
export function useH2HScoreReporting() {
  // The actual score reporting is handled by the parent HeadToHeadArena component
  // which passes onScoreUpdate prop to the game component
  // This hook is a placeholder for future enhancements like automatic score tracking

  const reportScore = (score: number) => {
    // Games should use the onScoreUpdate callback prop instead
    // This is just for reference
    console.warn('useH2HScoreReporting: Use the onScoreUpdate prop passed by HeadToHeadArena');
  };

  return { reportScore };
}

/**
 * H2H Score Submission Helper
 * Games should call this when scores update during H2H matches
 * 
 * Expected usage pattern in game components:
 * 
 * interface GameProps {
 *   h2hMode?: boolean;
 *   onScoreUpdate?: (score: number) => void;
 * }
 * 
 * const MyGame: React.FC<GameProps> = ({ h2hMode, onScoreUpdate }) => {
 *   const handleScoreUpdate = (newScore: number) => {
 *     if (h2hMode && onScoreUpdate) {
 *       onScoreUpdate(newScore);
 *     }
 *   };
 *   
 *   return (...);
 * };
 */
export const H2H_SCORE_UPDATE_PROPS = {
  h2hMode: 'boolean - set to true when game is running in H2H mode',
  onScoreUpdate: 'function(score: number) - call this whenever the player\'s score changes',
};

/**
 * Recommended game component pattern for H2H support
 */
export const GAME_H2H_INTEGRATION_TEMPLATE = `
import React, { useState } from 'react';

interface MyGameProps {
  h2hMode?: boolean;
  onScoreUpdate?: (score: number) => void;
}

const MyGame: React.FC<MyGameProps> = ({ h2hMode, onScoreUpdate }) => {
  const [score, setScore] = useState(0);

  const handleGameScoreUpdate = (newScore: number) => {
    setScore(newScore);
    
    // Report to H2H system if in H2H mode
    if (h2hMode && onScoreUpdate) {
      onScoreUpdate(newScore);
    }
  };

  return (
    // Game UI that calls handleGameScoreUpdate whenever score changes
  );
};

export default MyGame;
`;
