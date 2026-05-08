
import React, { useState, useEffect } from 'react';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';

// --- Types ---
type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 2-14
  isHidden?: boolean;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// --- Logic Helpers ---
const createDeck = (): Card[] => {
    const deck: Card[] = [];
    RANKS.forEach((r, i) => {
        SUITS.forEach(s => deck.push({ suit: s, rank: r, value: i + 2 }));
    });
    return deck.sort(() => Math.random() - 0.5);
};

// Simplified Hand Evaluator for Casino Hold'em
// Returns score: High Card < Pair < Two Pair < Trips < Straight < Flush < Full House < Quads < Straight Flush
const evaluateHand = (hole: Card[], community: Card[]): { score: number, name: string } => {
    const allCards = [...hole, ...community].sort((a, b) => b.value - a.value);
    const values = allCards.map(c => c.value);
    const suits = allCards.map(c => c.suit);
    
    // Helper to count frequencies
    const counts: {[key: number]: number} = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const countValues = Object.values(counts);
    
    // Flush
    const suitCounts: {[key: string]: number} = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
    const isFlush = !!flushSuit;

    // Straight
    let uniqueVals = Array.from(new Set(values));
    if (uniqueVals.includes(14)) uniqueVals.push(1); // Ace low
    uniqueVals.sort((a, b) => b - a);
    let streak = 0;
    let isStraight = false;
    for (let i = 0; i < uniqueVals.length - 1; i++) {
        if (uniqueVals[i] - uniqueVals[i+1] === 1) streak++;
        else streak = 0;
        if (streak >= 4) isStraight = true;
    }

    const isQuads = countValues.includes(4);
    const isTrips = countValues.includes(3);
    const pairCount = countValues.filter(c => c === 2).length;

    if (isStraight && isFlush) return { score: 900, name: 'Straight Flush' };
    if (isQuads) return { score: 800, name: 'Four of a Kind' };
    if (isTrips && pairCount >= 1) return { score: 700, name: 'Full House' };
    if (isFlush) return { score: 600, name: 'Flush' };
    if (isStraight) return { score: 500, name: 'Straight' };
    if (isTrips) return { score: 400, name: 'Three of a Kind' };
    if (pairCount >= 2) return { score: 300, name: 'Two Pair' };
    if (pairCount === 1) return { score: 200, name: 'Pair' };
    return { score: 100 + values[0], name: 'High Card' };
};

const TexasHoldemGame: React.FC = () => {
    const { canBet, subtractCoins, addCoins, currencyMode } = useCoinSystem();
    const [deck, setDeck] = useState<Card[]>([]);
    const [playerHand, setPlayerHand] = useState<Card[]>([]);
    const [dealerHand, setDealerHand] = useState<Card[]>([]);
    const [communityCards, setCommunityCards] = useState<Card[]>([]);
    const [gameState, setGameState] = useState<'IDLE' | 'ANTE' | 'DECISION' | 'SHOWDOWN'>('IDLE');
    const [ante, setAnte] = useState(10);
    const [message, setMessage] = useState('Ante up to play Casino Hold\'em');
    const currencySymbol = currencyMode === 'fun' ? 'FC' : 'RC';

    const deal = () => {
        if (!canBet(ante)) { setMessage('Insufficient Funds'); return; }
        subtractCoins(ante, 'Holdem Ante');
        
        const d = createDeck();
        const pHand = [d.pop()!, d.pop()!];
        const dHand = [d.pop()!, d.pop()!];
        const flop = [d.pop()!, d.pop()!, d.pop()!];
        
        setDeck(d);
        setPlayerHand(pHand);
        setDealerHand(dHand.map(c => ({...c, isHidden: true})));
        setCommunityCards(flop);
        setGameState('DECISION');
        setMessage('Call (2x Ante) or Fold?');
    };

    const fold = () => {
        setMessage('Folded. House wins ante.');
        setGameState('IDLE');
        setPlayerHand([]);
        setDealerHand([]);
        setCommunityCards([]);
    };

    const call = () => {
        const callBet = ante * 2;
        if (!canBet(callBet)) { setMessage('Can\'t afford to Call!'); return; }
        subtractCoins(callBet, 'Holdem Call');

        const d = [...deck];
        const turn = d.pop()!;
        const river = d.pop()!;
        const finalCommunity = [...communityCards, turn, river];
        
        setCommunityCards(finalCommunity);
        setDealerHand(prev => prev.map(c => ({...c, isHidden: false})));

        // Dealer Qualification (Pair of 4s or better)
        // For simplicity in this arcade version:
        // Compare hands directly.
        
        const pResult = evaluateHand(playerHand, finalCommunity);
        const dResult = evaluateHand(dealerHand.map(c => ({...c, isHidden: false})), finalCommunity);

        setGameState('SHOWDOWN');
        
        if (pResult.score > dResult.score) {
            const win = (ante * 3) + (callBet * 2); // Simple payout simplification
            addCoins(win, 'Holdem Win');
            setMessage(`You Win! ${pResult.name} beats ${dResult.name}`);
        } else if (pResult.score < dResult.score) {
            setMessage(`Dealer Wins with ${dResult.name}`);
        } else {
            addCoins(ante + callBet, 'Holdem Push');
            setMessage('Push! Bets returned.');
        }
    };

    const CardView: React.FC<{ card: Card }> = ({ card }) => {
        if (card.isHidden) {
            return <div className="w-14 h-20 md:w-20 md:h-28 bg-red-900 rounded border-2 border-white shadow-md bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>;
        }
        const color = ['♥', '♦'].includes(card.suit) ? 'text-red-500' : 'text-black';
        return (
            <div className={`w-14 h-20 md:w-20 md:h-28 bg-white rounded shadow-md flex flex-col items-center justify-center ${color} font-bold text-xl`}>
                <span>{card.rank}</span>
                <span className="text-2xl">{card.suit}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-4xl p-4 bg-[#0a2f18] rounded-3xl border-8 border-[#4a3b2a] shadow-2xl">
            {/* Dealer */}
            <div className="flex flex-col items-center gap-2">
                <div className="text-gray-400 text-xs font-bold uppercase">Dealer</div>
                <div className="flex gap-2">
                    {dealerHand.length > 0 ? dealerHand.map((c, i) => <CardView key={i} card={c} />) : <div className="h-20 md:h-28"></div>}
                </div>
            </div>

            {/* Community */}
            <div className="flex gap-2 md:gap-4 bg-[#0f4224] p-4 rounded-full border-4 border-[#daa520]/30">
                {communityCards.map((c, i) => <CardView key={i} card={c} />)}
                {communityCards.length === 0 && <div className="text-[#daa520] font-bold">COMMUNITY CARDS</div>}
            </div>

            {/* Message */}
            <div className="text-yellow-400 font-bold text-xl text-center h-8">{message}</div>

            {/* Player */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                    {playerHand.map((c, i) => <CardView key={i} card={c} />)}
                </div>
                <div className="text-gray-400 text-xs font-bold uppercase">You</div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 mt-4">
                {gameState === 'IDLE' || gameState === 'SHOWDOWN' ? (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-black/30 rounded-lg p-1">
                            <button onClick={() => setAnte(Math.max(10, ante - 10))} className="w-8 h-8 bg-red-500 text-white rounded">-</button>
                            <span className="w-16 text-center text-white font-bold">{ante}</span>
                            <button onClick={() => setAnte(ante + 10)} className="w-8 h-8 bg-green-500 text-white rounded">+</button>
                        </div>
                        <GlassButton onClick={deal} className="!bg-yellow-500 text-black px-8">DEAL ANTE</GlassButton>
                    </div>
                ) : (
                    <>
                        <button onClick={fold} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full">FOLD</button>
                        <button onClick={call} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full">CALL ({ante * 2})</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default TexasHoldemGame;
