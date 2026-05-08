
import React, { useState, useEffect, useCallback } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
  isHidden?: boolean;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const getCardValue = (rank: Rank): number => {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
};

const BlackjackGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
  const [bet, setBet] = useState(10);
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<'BETTING' | 'PLAYING' | 'DEALER_TURN' | 'GAME_OVER'>('BETTING');
  const [message, setMessage] = useState('Place your bet to start');
  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

  // --- Deck Management ---
  const createDeck = () => {
    const newDeck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        newDeck.push({ suit, rank, value: getCardValue(rank) });
      }
    }
    return newDeck.sort(() => Math.random() - 0.5);
  };

  const drawCard = (currentDeck: Card[], hidden = false): { card: Card; newDeck: Card[] } => {
    const card = currentDeck[0];
    const newDeck = currentDeck.slice(1);
    return { card: { ...card, isHidden: hidden }, newDeck };
  };

  const calculateScore = (hand: Card[]) => {
    let score = 0;
    let aces = 0;
    hand.forEach(card => {
      if (card.isHidden) return;
      score += card.value;
      if (card.rank === 'A') aces += 1;
    });
    while (score > 21 && aces > 0) {
      score -= 10;
      aces -= 1;
    }
    return score;
  };

  // --- Game Actions ---
  const dealGame = () => {
    if (!canBet(bet)) {
      setMessage('Insufficient funds!');
      return;
    }
    subtractCoins(bet, 'Blackjack Bet');
    
    let d = createDeck();
    const pHand: Card[] = [];
    const dHand: Card[] = [];

    // Deal: P, D, P, D(Hidden)
    let draw = drawCard(d); pHand.push(draw.card); d = draw.newDeck;
    draw = drawCard(d); dHand.push(draw.card); d = draw.newDeck;
    draw = drawCard(d); pHand.push(draw.card); d = draw.newDeck;
    draw = drawCard(d, true); dHand.push(draw.card); d = draw.newDeck;

    setDeck(d);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setGameState('PLAYING');
    setMessage('Hit or Stand?');

    // Check for Instant Blackjack
    const pScore = calculateScore(pHand);
    if (pScore === 21) {
       handleGameOver(pHand, dHand, true);
    }
  };

  const hit = () => {
    const { card, newDeck } = drawCard(deck);
    const newHand = [...playerHand, card];
    setDeck(newDeck);
    setPlayerHand(newHand);

    const score = calculateScore(newHand);
    if (score > 21) {
      setGameState('GAME_OVER');
      setMessage('Bust! Dealer wins.');
      // Reveal dealer card for UI
      setDealerHand(prev => prev.map(c => ({...c, isHidden: false})));
    }
  };

  const stand = () => {
    setGameState('DEALER_TURN');
  };

  const doubleDown = () => {
    if (!canBet(bet)) {
        setMessage("Can't afford to double!");
        return;
    }
    subtractCoins(bet, 'Blackjack Double');
    const { card, newDeck } = drawCard(deck);
    const newHand = [...playerHand, card];
    setDeck(newDeck);
    setPlayerHand(newHand);
    
    const score = calculateScore(newHand);
    if (score > 21) {
        setGameState('GAME_OVER');
        setMessage(`Bust! Dealer wins. (-${bet * 2})`);
        setDealerHand(prev => prev.map(c => ({...c, isHidden: false})));
    } else {
        // Auto stand after double
        setGameState('DEALER_TURN');
    }
  };

  // --- Dealer Logic ---
  useEffect(() => {
    if (gameState === 'DEALER_TURN') {
      let currentDealerHand = dealerHand.map(c => ({ ...c, isHidden: false }));
      let dDeck = [...deck];
      let dScore = calculateScore(currentDealerHand);

      const playDealer = async () => {
        setDealerHand(currentDealerHand); // Reveal first
        await new Promise(r => setTimeout(r, 600));

        while (dScore < 17) {
          const { card, newDeck } = drawCard(dDeck);
          dDeck = newDeck;
          currentDealerHand = [...currentDealerHand, card];
          dScore = calculateScore(currentDealerHand);
          setDealerHand(currentDealerHand);
          setDeck(dDeck);
          await new Promise(r => setTimeout(r, 800));
        }
        handleGameOver(playerHand, currentDealerHand, false, gameState === 'DEALER_TURN' && bet * (playerHand.length === 3 && bet > 10 ? 2 : 1)); // Check current bet logic manually or just pass nothing
      };
      playDealer();
    }
  }, [gameState]);

  const handleGameOver = (pHand: Card[], dHand: Card[], playerBlackjack = false, currentTotalBet?: number) => {
    const finalBet = currentTotalBet || (playerHand.length === 3 ? bet * 2 : bet); // Rudimentary double check
    const pScore = calculateScore(pHand);
    const dScore = calculateScore(dHand);
    setGameState('GAME_OVER');

    if (playerBlackjack) {
        // Check if dealer also has blackjack
        const dBlackjack = calculateScore(dHand) === 21 && dHand.length === 2;
        if (dBlackjack) {
            addCoins(bet, 'Blackjack Push');
            setMessage('Push! Both have Blackjack.');
        } else {
            const win = bet * 2.5;
            addCoins(win, 'Blackjack!');
            setMessage(`Blackjack! You won ${win} ${currencySymbol}!`);
        }
        setDealerHand(dHand.map(c => ({...c, isHidden: false})));
        return;
    }

    if (pScore > 21) {
        setMessage('Bust! Dealer wins.');
    } else if (dScore > 21) {
        const win = finalBet * 2;
        addCoins(win, 'Blackjack Win (Dealer Bust)');
        setMessage(`Dealer Bust! You won ${win} ${currencySymbol}!`);
    } else if (pScore > dScore) {
        const win = finalBet * 2;
        addCoins(win, 'Blackjack Win');
        setMessage(`You Win! ${pScore} vs ${dScore}`);
    } else if (pScore < dScore) {
        setMessage(`Dealer Wins. ${dScore} vs ${pScore}`);
    } else {
        addCoins(finalBet, 'Blackjack Push');
        setMessage('Push! Bets returned.');
    }
  };

  // --- UI Components ---
  const CardView: React.FC<{ card: Card }> = ({ card }) => {
    if (card.isHidden) {
      return (
        <div className="w-16 h-24 md:w-24 md:h-36 bg-blue-800 rounded-lg border-2 border-white shadow-lg flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]">
           <div className="w-12 h-16 border border-blue-400/30 rounded-sm"></div>
        </div>
      );
    }
    const color = ['♥', '♦'].includes(card.suit) ? 'text-red-500' : 'text-black';
    return (
      <div className={`w-16 h-24 md:w-24 md:h-36 bg-white rounded-lg shadow-lg flex flex-col items-center justify-between p-1 md:p-2 ${color} transition-transform hover:-translate-y-2`}>
        <div className="self-start text-sm md:text-xl font-bold leading-none">{card.rank}<br/>{card.suit}</div>
        <div className="text-2xl md:text-4xl">{card.suit}</div>
        <div className="self-end text-sm md:text-xl font-bold leading-none rotate-180">{card.rank}<br/>{card.suit}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl gap-6 p-4 bg-[#0f3318] rounded-3xl border-8 border-[#2d1b0e] shadow-2xl">
      {/* Dealer Area */}
      <div className="flex flex-col items-center gap-2 min-h-[160px]">
        <div className="text-gray-300 text-sm font-bold uppercase tracking-widest">Dealer {gameState !== 'BETTING' && `(${calculateScore(dealerHand)})`}</div>
        <div className="flex gap-2 md:gap-4">
          {dealerHand.map((c, i) => <CardView key={i} card={c} />)}
          {dealerHand.length === 0 && <div className="w-24 h-36 border-2 border-dashed border-green-700 rounded-lg opacity-30"></div>}
        </div>
      </div>

      {/* Game Info */}
      <div className="flex flex-col items-center justify-center h-20">
          <div className="text-yellow-400 font-bold text-xl md:text-2xl drop-shadow-md text-center">{message}</div>
      </div>

      {/* Player Area */}
      <div className="flex flex-col items-center gap-2 min-h-[160px]">
        <div className="flex gap-2 md:gap-4">
          {playerHand.map((c, i) => <CardView key={i} card={c} />)}
          {playerHand.length === 0 && <div className="w-24 h-36 border-2 border-dashed border-green-700 rounded-lg opacity-30"></div>}
        </div>
        <div className="text-gray-300 text-sm font-bold uppercase tracking-widest">Player {gameState !== 'BETTING' && `(${calculateScore(playerHand)})`}</div>
      </div>

      {/* Controls */}
      <div className="w-full bg-black/30 p-4 rounded-xl backdrop-blur-md flex flex-col md:flex-row gap-4 justify-center items-center">
        {gameState === 'BETTING' || gameState === 'GAME_OVER' ? (
           <div className="flex gap-4 items-center">
               <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg">
                   <button onClick={() => setBet(Math.max(10, bet - 10))} className="w-8 h-8 bg-red-500 rounded text-white font-bold">-</button>
                   <span className="text-white font-bold w-16 text-center">{bet}</span>
                   <button onClick={() => setBet(bet + 10)} className="w-8 h-8 bg-green-500 rounded text-white font-bold">+</button>
               </div>
               <GlassButton onClick={dealGame} className="!bg-yellow-500 hover:!bg-yellow-400 text-black min-w-[120px]">
                   {gameState === 'GAME_OVER' ? 'PLAY AGAIN' : 'DEAL'}
               </GlassButton>
           </div>
        ) : (
           <div className="flex gap-4">
               <button 
                 onClick={hit} 
                 disabled={gameState !== 'PLAYING'}
                 className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
               >
                 HIT
               </button>
               <button 
                 onClick={stand} 
                 disabled={gameState !== 'PLAYING'}
                 className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
               >
                 STAND
               </button>
               {playerHand.length === 2 && canBet(bet) && (
                   <button 
                    onClick={doubleDown} 
                    disabled={gameState !== 'PLAYING'}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
                   >
                    DOUBLE
                   </button>
               )}
           </div>
        )}
      </div>
    </div>
  );
};

export default BlackjackGame;
