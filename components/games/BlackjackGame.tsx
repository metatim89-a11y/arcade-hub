
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const DECKS_IN_SHOE = 6;
const SHUFFLE_THRESHOLD = 60; // Shuffle when fewer than 60 cards remain

const getCardValue = (rank: Rank): number => {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
};

const BlackjackGame: React.FC = () => {
  const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
  
  // Game States
  const [baseBet, setBaseBet] = useState(10);
  const [currentBet, setCurrentBet] = useState(0);
  const [shoe, setShoe] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<'BETTING' | 'PLAYING' | 'DEALER_TURN' | 'GAME_OVER'>('BETTING');
  const [message, setMessage] = useState('Place your bet to start');
  
  const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

  // --- Shoe Management ---
  const createShoe = useCallback(() => {
    const newShoe: Card[] = [];
    for (let d = 0; d < DECKS_IN_SHOE; d++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                newShoe.push({ suit, rank, value: getCardValue(rank) });
            }
        }
    }
    // Fisher-Yates Shuffle
    for (let i = newShoe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newShoe[i], newShoe[j]] = [newShoe[j], newShoe[i]];
    }
    return newShoe;
  }, []);

  const drawCard = useCallback((currentShoe: Card[], hidden = false) => {
    let activeShoe = [...currentShoe];
    if (activeShoe.length === 0) {
        activeShoe = createShoe();
    }
    const card = activeShoe.shift()!;
    return { card: { ...card, isHidden: hidden }, newShoe: activeShoe };
  }, [createShoe]);

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
    if (!canBet(baseBet)) {
      setMessage('Insufficient funds!');
      return;
    }

    // Integrity: Ensure shoe is ready
    let currentShoe = shoe.length < SHUFFLE_THRESHOLD ? createShoe() : [...shoe];
    
    subtractCoins(baseBet, 'Blackjack Bet');
    setCurrentBet(baseBet);
    
    const pHand: Card[] = [];
    const dHand: Card[] = [];

    // Deal Sequence
    let res = drawCard(currentShoe); pHand.push(res.card); currentShoe = res.newShoe;
    res = drawCard(currentShoe); dHand.push(res.card); currentShoe = res.newShoe;
    res = drawCard(currentShoe); pHand.push(res.card); currentShoe = res.newShoe;
    res = drawCard(currentShoe, true); dHand.push(res.card); currentShoe = res.newShoe;

    setShoe(currentShoe);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setGameState('PLAYING');
    setMessage('Hit, Stand or Double?');

    // Instant Blackjack Check
    const pScore = calculateScore(pHand);
    const dScore = calculateScore(dHand.map(c => ({...c, isHidden: false})));
    
    if (pScore === 21) {
       handleGameOver(pHand, dHand.map(c => ({...c, isHidden: false})), true);
    }
  };

  const hit = () => {
    const { card, newShoe } = drawCard(shoe);
    const newHand = [...playerHand, card];
    setShoe(newShoe);
    setPlayerHand(newHand);

    const score = calculateScore(newHand);
    if (score > 21) {
      handleGameOver(newHand, dealerHand.map(c => ({...c, isHidden: false})), false);
    }
  };

  const stand = () => {
    setGameState('DEALER_TURN');
  };

  const doubleDown = () => {
    if (!canBet(baseBet)) {
        setMessage("Not enough coins to double!");
        return;
    }
    subtractCoins(baseBet, 'Blackjack Double');
    setCurrentBet(prev => prev + baseBet);
    
    const { card, newShoe } = drawCard(shoe);
    const newHand = [...playerHand, card];
    setShoe(newShoe);
    setPlayerHand(newHand);
    
    const score = calculateScore(newHand);
    if (score > 21) {
        handleGameOver(newHand, dealerHand.map(c => ({...c, isHidden: false})), false, baseBet * 2);
    } else {
        setGameState('DEALER_TURN');
    }
  };

  // --- Dealer Logic ---
  useEffect(() => {
    if (gameState === 'DEALER_TURN') {
      const playDealer = async () => {
        let currentDealerHand = dealerHand.map(c => ({ ...c, isHidden: false }));
        let currentShoe = [...shoe];
        let dScore = calculateScore(currentDealerHand);

        setDealerHand(currentDealerHand); // Reveal
        await new Promise(r => setTimeout(r, 800));

        while (dScore < 17) {
          const res = drawCard(currentShoe);
          currentShoe = res.newShoe;
          currentDealerHand = [...currentDealerHand, res.card];
          dScore = calculateScore(currentDealerHand);
          
          setDealerHand(currentDealerHand);
          setShoe(currentShoe);
          await new Promise(r => setTimeout(r, 800));
        }
        
        handleGameOver(playerHand, currentDealerHand);
      };
      playDealer();
    }
  }, [gameState, playerHand, drawCard]);

  const handleGameOver = (pHand: Card[], dHand: Card[], isPBlackjack = false, finalBet?: number) => {
    const betAmount = finalBet || currentBet;
    const pScore = calculateScore(pHand);
    const dScore = calculateScore(dHand);
    const isDBlackjack = dScore === 21 && dHand.length === 2;
    
    setGameState('GAME_OVER');
    setDealerHand(dHand.map(c => ({...c, isHidden: false})));

    if (isPBlackjack) {
        if (isDBlackjack) {
            addCoins(betAmount, 'Blackjack Push');
            setMessage('Push! Both have Blackjack.');
        } else {
            const payout = betAmount * 2.5;
            addCoins(payout, 'Blackjack Payout');
            setMessage(`BLACKJACK! Won ${payout} ${currencySymbol}`);
        }
        return;
    }

    if (pScore > 21) {
        setMessage('Bust! Dealer wins.');
    } else if (dScore > 21) {
        const payout = betAmount * 2;
        addCoins(payout, 'Dealer Bust');
        setMessage(`Dealer Bust! Won ${payout} ${currencySymbol}`);
    } else if (pScore > dScore) {
        const payout = betAmount * 2;
        addCoins(payout, 'Win');
        setMessage(`You Win! ${pScore} vs ${dScore}`);
    } else if (pScore < dScore) {
        setMessage(`Dealer Wins. ${dScore} vs ${pScore}`);
    } else {
        addCoins(betAmount, 'Push');
        setMessage(`Push! Both have ${pScore}`);
    }
  };

  // --- UI ---
  const CardView: React.FC<{ card: Card, index: number }> = ({ card, index }) => {
    const [isFlipped, setIsFlipped] = useState(card.isHidden);

    useEffect(() => {
        setIsFlipped(card.isHidden);
    }, [card.isHidden]);

    return (
        <div 
            className="relative w-16 h-24 md:w-24 md:h-36 perspective-1000 animate-deal-in"
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${!isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Back of Card */}
                <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl border-4 border-white shadow-xl flex items-center justify-center">
                    <div className="w-12 h-20 border-2 border-blue-400/20 rounded-lg flex items-center justify-center">
                        <span className="text-3xl opacity-20">🂠</span>
                    </div>
                </div>
                {/* Front of Card */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-xl shadow-xl flex flex-col justify-between p-2 border border-gray-200">
                    <div className={`text-sm md:text-xl font-black leading-none ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.rank}<br/>{card.suit}
                    </div>
                    <div className={`text-3xl md:text-5xl self-center ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.suit}
                    </div>
                    <div className={`text-sm md:text-xl font-black leading-none rotate-180 ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.rank}<br/>{card.suit}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl p-6 bg-gradient-to-b from-green-800 to-green-950 rounded-[40px] border-[12px] border-[#3e2723] shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
      
      {/* Table Felt Decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] border-[40px] border-green-700/20 rounded-full pointer-events-none"></div>

      {/* Shoe Indicator */}
      <div className="absolute top-4 right-8 text-green-300/50 text-[10px] font-black uppercase tracking-[0.2em]">
          Shoe: {shoe.length} / {DECKS_IN_SHOE * 52}
          <div className="w-24 h-1 bg-green-900 mt-1 rounded-full overflow-hidden">
              <div className="h-full bg-green-400" style={{ width: `${(shoe.length / (DECKS_IN_SHOE * 52)) * 100}%` }}></div>
          </div>
      </div>

      {/* Dealer Hand */}
      <div className="flex flex-col items-center gap-4 z-10">
        <div className="bg-black/40 px-4 py-1 rounded-full text-xs font-bold text-gray-300 uppercase tracking-widest border border-white/5">
            Dealer {gameState !== 'BETTING' && `• ${calculateScore(dealerHand)}`}
        </div>
        <div className="flex gap-2 md:gap-4 h-36">
          {dealerHand.map((c, i) => <CardView key={i} card={c} index={i} />)}
          {dealerHand.length === 0 && <div className="w-24 h-36 border-4 border-dashed border-green-900/50 rounded-xl"></div>}
        </div>
      </div>

      {/* Message Board */}
      <div className="my-8 flex flex-col items-center justify-center min-h-[60px] text-center px-4">
          <div className="text-2xl md:text-3xl font-black text-yellow-400 italic tracking-tight drop-shadow-2xl animate-pulse">
              {message}
          </div>
          {currentBet > 0 && <div className="text-white/60 text-xs font-bold mt-2">ACTIVE BET: {currentBet} {currencySymbol}</div>}
      </div>

      {/* Player Hand */}
      <div className="flex flex-col items-center gap-4 z-10">
        <div className="flex gap-2 md:gap-4 h-36">
          {playerHand.map((c, i) => <CardView key={i} card={c} index={i} />)}
          {playerHand.length === 0 && <div className="w-24 h-36 border-4 border-dashed border-green-900/50 rounded-xl"></div>}
        </div>
        <div className="bg-black/40 px-4 py-1 rounded-full text-xs font-bold text-gray-300 uppercase tracking-widest border border-white/5">
            Player {gameState !== 'BETTING' && `• ${calculateScore(playerHand)}`}
        </div>
      </div>

      {/* Control Station */}
      <div className="w-full mt-10 bg-[#1b1b1b] p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row gap-6 justify-between items-center">
        
        {gameState === 'BETTING' || gameState === 'GAME_OVER' ? (
           <div className="flex flex-wrap justify-center gap-6 items-center">
               <div className="flex items-center gap-3 bg-black/60 p-3 rounded-2xl border border-white/10">
                   <button onClick={() => setBaseBet(Math.max(10, baseBet - 10))} className="w-10 h-10 bg-gray-800 hover:bg-red-900 rounded-xl text-white font-black shadow-lg transition-all">-</button>
                   <div className="text-center w-20">
                       <div className="text-[10px] text-gray-500 font-bold uppercase">BET</div>
                       <div className="text-yellow-500 font-black text-xl">{baseBet}</div>
                   </div>
                   <button onClick={() => setBaseBet(baseBet + 10)} className="w-10 h-10 bg-gray-800 hover:bg-green-900 rounded-xl text-white font-black shadow-lg transition-all">+</button>
               </div>
               <GlassButton onClick={dealGame} className="!py-4 !px-12 text-xl font-black !bg-yellow-500 hover:!bg-yellow-400 !text-black shadow-[0_5px_0_rgb(154,52,18)] active:translate-y-1 active:shadow-none">
                   {gameState === 'GAME_OVER' ? 'RE-DEAL' : 'DEAL HAND'}
               </GlassButton>
           </div>
        ) : (
           <div className="flex flex-wrap justify-center gap-4">
               <button 
                 onClick={hit} 
                 disabled={gameState !== 'PLAYING'}
                 className="bg-green-600 hover:bg-green-500 text-white font-black py-4 px-10 rounded-2xl shadow-[0_5px_0_rgb(21,128,61)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-30"
               >
                 HIT
               </button>
               <button 
                 onClick={stand} 
                 disabled={gameState !== 'PLAYING'}
                 className="bg-red-600 hover:bg-red-500 text-white font-black py-4 px-10 rounded-2xl shadow-[0_5px_0_rgb(153,27,27)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-30"
               >
                 STAND
               </button>
               {playerHand.length === 2 && canBet(baseBet) && (
                   <button 
                    onClick={doubleDown} 
                    disabled={gameState !== 'PLAYING'}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 px-10 rounded-2xl shadow-[0_5px_0_rgb(154,52,18)] active:translate-y-1 active:shadow-none transition-all"
                   >
                    DOUBLE
                   </button>
               )}
           </div>
        )}

        <div className="flex flex-col items-end">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Bankroll</div>
            <div className="text-2xl font-black text-green-400 italic">
                {currencyMode === 'fun' ? Math.floor(useCoinSystem().funCoins) : Math.floor(useCoinSystem().realCoins)} <span className="text-xs">{currencySymbol}</span>
            </div>
        </div>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        
        @keyframes deal-in {
            from { transform: translate(200px, -200px) rotate(20deg); opacity: 0; }
            to { transform: translate(0, 0) rotate(0deg); opacity: 1; }
        }
        .animate-deal-in {
            animation: deal-in 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default BlackjackGame;
