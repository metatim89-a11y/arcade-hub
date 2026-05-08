
import React, { useState, useEffect } from 'react';
import { PlayMode } from '../../types';
import GlassButton from '../ui/GlassButton';

const SYMBOLS = ['✊', '✋', '✌️', '💣', '💎', '👑', '🔥', '💧'];

interface Card {
  id: number;
  symbol: string;
  isFlipped: boolean;
  isMatched: boolean;
}
interface RPSCardGameProps {
  playMode: PlayMode;
}

const createShuffledBoard = (): Card[] => {
  const duplicatedSymbols = [...SYMBOLS, ...SYMBOLS];
  const shuffled = duplicatedSymbols.sort(() => Math.random() - 0.5);
  return shuffled.map((symbol, index) => ({ id: index, symbol, isFlipped: false, isMatched: false }));
};

const StunDropAnimation = () => {
    const particles = Array.from({ length: 12 }).map((_, i) => {
        const angle = (Math.random() * 360) * (Math.PI / 180);
        const xEnd = Math.cos(angle) * (20 + Math.random() * 30); 
        const yEnd = Math.sin(angle) * (20 + Math.random() * 30);
        return {
            '--x-end': `${xEnd}px`,
            '--y-end': `${yEnd}px`,
            animationDelay: `${Math.random() * 0.2}s`,
        } as React.CSSProperties;
    });

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-visible">
            <div className="stun-flash-effect"></div>
            {particles.map((style, i) => (
                <div key={i} className="stun-particle" style={style}></div>
            ))}
        </div>
    );
};

const RPSCardGame: React.FC<RPSCardGameProps> = ({ playMode }) => {
    const [board, setBoard] = useState<Card[]>(createShuffledBoard());
    const [flippedCards, setFlippedCards] = useState<number[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
    const [scores, setScores] = useState({ player1: 0, player2: 0 });
    const [status, setStatus] = useState("Player 1's Turn");
    const [gameOver, setGameOver] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastMatchSymbol, setLastMatchSymbol] = useState<string | null>(null);

    const checkMatch = () => {
        if (flippedCards.length !== 2) return;
        setIsChecking(true);
        const [firstId, secondId] = flippedCards;
        const firstCard = board.find(c => c.id === firstId)!;
        const secondCard = board.find(c => c.id === secondId)!;

        if (firstCard.symbol === secondCard.symbol) {
            setBoard(prev => prev.map(card => card.symbol === firstCard.symbol ? { ...card, isMatched: true, isFlipped: true } : card));
            setScores(s => currentPlayer === 1 ? { ...s, player1: s.player1 + 1 } : { ...s, player2: s.player2 + 1 });
            setLastMatchSymbol(firstCard.symbol);
            setTimeout(() => setLastMatchSymbol(null), 500); // Animation display time
            setFlippedCards([]);
            setIsChecking(false);
        } else {
            setTimeout(() => {
                setBoard(prev => prev.map(card => flippedCards.includes(card.id) ? { ...card, isFlipped: false } : card));
                const nextPlayer = currentPlayer === 1 ? 2 : 1;
                setCurrentPlayer(nextPlayer);
                setStatus(`Player ${nextPlayer}'s Turn`);
                setFlippedCards([]);
                setIsChecking(false);
            }, 1000);
        }
    };

    useEffect(() => {
        if (flippedCards.length === 2) {
            checkMatch();
        }
    }, [flippedCards]);
    
    useEffect(() => {
      if (board.length > 0 && board.every(c => c.isMatched)) {
        setGameOver(true);
        const winnerName = playMode === 'vsComputer' ? 'Computer' : 'Player 2';
        if (scores.player1 > scores.player2) {
          setStatus('Player 1 Wins!');
        } else if (scores.player2 > scores.player1) {
          setStatus(`${winnerName} Wins!`);
        } else {
          setStatus("It's a Draw!");
        }
      }
    }, [board, scores, playMode]);

    useEffect(() => {
        if (playMode === 'vsComputer' && currentPlayer === 2 && !gameOver && !isChecking && flippedCards.length < 2) {
            const timer = setTimeout(() => {
                const availableCards = board.filter(c => !c.isFlipped);
                if (availableCards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableCards.length);
                    handleCardClick(availableCards[randomIndex].id);
                }
            }, 700 + flippedCards.length * 200);
            return () => clearTimeout(timer);
        }
    }, [currentPlayer, playMode, gameOver, board, isChecking, flippedCards]);

    const handleCardClick = (id: number) => {
        const card = board.find(c => c.id === id);
        if (isChecking || !card || card.isFlipped || flippedCards.length >= 2 || (playMode === 'vsComputer' && currentPlayer === 2)) return;
        setFlippedCards(prev => [...prev, id]);
        setBoard(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));
    };

    const handleReset = () => {
        setBoard(createShuffledBoard());
        setFlippedCards([]);
        setCurrentPlayer(1);
        setScores({ player1: 0, player2: 0 });
        setStatus("Player 1's Turn");
        setGameOver(false);
        setIsChecking(false);
    };

    const computerName = playMode === 'vsComputer' ? 'Computer' : 'Player 2';

    return (
        <div className="flex flex-col items-center justify-center gap-4 text-white w-full">
            <h2 className="text-3xl font-bold text-yellow-400">RPS Memory Match</h2>
            <div className="flex justify-around w-full max-w-sm text-xl font-bold">
                <span>Player 1: {scores.player1}</span>
                <span>{computerName}: {scores.player2}</span>
            </div>
            <div className="text-lg font-semibold h-7 mb-2">{status}</div>
            <div className="grid grid-cols-4 gap-2 md:gap-4">
                {board.map(card => (
                    <div
                        key={card.id}
                        className="relative w-20 h-20 md:w-24 md:h-24 perspective"
                        onClick={() => handleCardClick(card.id)}
                    >
                        <div className={`card-inner ${card.isFlipped ? 'is-flipped' : ''} ${card.isMatched ? 'is-matched' : ''}`}>
                            <div className="card-front bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"></div>
                            <div className="card-back bg-gray-700 rounded-lg flex items-center justify-center text-4xl">
                                {card.symbol}
                            </div>
                        </div>
                        {card.isMatched && lastMatchSymbol === card.symbol && <StunDropAnimation />}
                    </div>
                ))}
            </div>
            {gameOver && <GlassButton onClick={handleReset} className="mt-4 text-xl py-3">Play Again</GlassButton>}
        </div>
    );
};

export default RPSCardGame;
