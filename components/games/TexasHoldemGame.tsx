import React, { useEffect, useRef, useState } from 'react';

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
type Phase = 'SETUP' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
type Action = 'fold' | 'check-call' | 'raise' | 'all-in';

type Card = { id: string; suit: Suit; rank: Rank; value: number };
type HandRank = { category: number; kickers: number[]; name: string };
type Player = {
  id: number;
  name: string;
  isHuman: boolean;
  hand: Card[];
  stack: number;
  bet: number;
  contributed: number;
  folded: boolean;
  allIn: boolean;
};

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const STARTING_STACK = 500;

const secureIndex = (max: number) => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return Math.floor((values[0] / 4294967296) * max);
};

const createDeck = (): Card[] => {
  const deck = RANKS.flatMap((rank, rankIndex) =>
    SUITS.map((suit) => ({ id: `${rank}${suit}`, suit, rank, value: rankIndex + 2 }))
  );
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
};

const compareRanks = (left: HandRank, right: HandRank) => {
  if (left.category !== right.category) return left.category - right.category;
  const length = Math.max(left.kickers.length, right.kickers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left.kickers[index] ?? 0) - (right.kickers[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
};

const rankFive = (cards: Card[]): HandRank => {
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const unique = [...new Set(values)];
  const wheel = unique.includes(14) ? [...unique, 1] : unique;
  let straightHigh = 0;
  for (let index = 0; index <= wheel.length - 5; index += 1) {
    if (wheel[index] - wheel[index + 4] === 4) {
      straightHigh = wheel[index];
      break;
    }
  }
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const groups = [...new Set(values)]
    .map((value) => ({ value, count: values.filter((candidate) => candidate === value).length }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (flush && straightHigh) return { category: 8, kickers: [straightHigh], name: 'Straight Flush' };
  if (groups[0].count === 4) return { category: 7, kickers: [groups[0].value, groups[1].value], name: 'Four of a Kind' };
  if (groups[0].count === 3 && groups[1].count === 2) return { category: 6, kickers: [groups[0].value, groups[1].value], name: 'Full House' };
  if (flush) return { category: 5, kickers: values, name: 'Flush' };
  if (straightHigh) return { category: 4, kickers: [straightHigh], name: 'Straight' };
  if (groups[0].count === 3) {
    return { category: 3, kickers: [groups[0].value, ...groups.slice(1).map((group) => group.value)], name: 'Three of a Kind' };
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = [groups[0].value, groups[1].value].sort((a, b) => b - a);
    return { category: 2, kickers: [...pairs, groups[2].value], name: 'Two Pair' };
  }
  if (groups[0].count === 2) {
    return { category: 1, kickers: [groups[0].value, ...groups.slice(1).map((group) => group.value)], name: 'One Pair' };
  }
  return { category: 0, kickers: values, name: 'High Card' };
};

const evaluateHand = (cards: Card[]): HandRank => {
  let best: HandRank | null = null;
  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            const candidate = rankFive([cards[first], cards[second], cards[third], cards[fourth], cards[fifth]]);
            if (!best || compareRanks(candidate, best) > 0) best = candidate;
          }
        }
      }
    }
  }
  return best ?? { category: 0, kickers: [], name: 'No Hand' };
};

const CardView: React.FC<{ card?: Card; hidden?: boolean; newlyDealt?: boolean; dealDelay?: number }> = ({ card, hidden = false, newlyDealt = false, dealDelay = 0 }) => {
  if (!card) return <div className="holdem-card-slot" aria-hidden="true" />;
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`holdem-card${newlyDealt ? ' dealt' : ''}${hidden ? ' hidden' : ''}`} style={newlyDealt ? { animationDelay: `${dealDelay}ms` } : undefined} aria-label={hidden ? 'Hidden card' : `${card.rank} of ${card.suit}`}>
      {hidden ? <div className="card-back-mark">AH</div> : (
        <>
          <span className={red ? 'red' : ''}>{card.rank}</span>
          <strong className={red ? 'red' : ''}>{card.suit}</strong>
          <b className={`card-rank-bottom${red ? ' red' : ''}`}>{card.rank}</b>
        </>
      )}
    </div>
  );
};

const nextIndex = (from: number, players: Player[], predicate: (player: Player) => boolean) => {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (from + offset) % players.length;
    if (predicate(players[index])) return index;
  }
  return -1;
};

const TexasHoldemGame: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('SETUP');
  const [humanCount, setHumanCount] = useState(1);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [community, setCommunity] = useState<Card[]>([]);
  const [actionIndex, setActionIndex] = useState(-1);
  const [dealerIndex, setDealerIndex] = useState(-1);
  const [smallBlindIndex, setSmallBlindIndex] = useState(-1);
  const [bigBlindIndex, setBigBlindIndex] = useState(-1);
  const [message, setMessage] = useState('Choose how many local players are joining the table.');
  const [handNumber, setHandNumber] = useState(0);
  const [lastBoardCount, setLastBoardCount] = useState(0);
  const [cpuDifficulty, setCpuDifficulty] = useState<'Casual' | 'Sharp' | 'Expert'>('Sharp');
  const [tableTheme, setTableTheme] = useState<'Classic' | 'Midnight' | 'Royal'>('Classic');
  const [practiceInfo, setPracticeInfo] = useState(true);
  const [tournamentMode, setTournamentMode] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(BIG_BLIND);
  const [history, setHistory] = useState<string[]>([]);
  const [lastActions, setLastActions] = useState<Record<number, string>>({});
  const [emotes, setEmotes] = useState<Record<number, string>>({});

  const playersRef = useRef<Player[]>([]);
  const communityRef = useRef<Card[]>([]);
  const deckRef = useRef<Card[]>([]);
  const phaseRef = useRef<Phase>('SETUP');
  const dealerRef = useRef(-1);
  const actionRef = useRef(-1);
  const currentBetRef = useRef(0);
  const pendingRef = useRef<Set<number>>(new Set());
  const actionHandlerRef = useRef<(action: Action) => void>(() => undefined);

  const commitPlayers = (next: Player[]) => {
    playersRef.current = next;
    setPlayers(next);
  };
  const commitCommunity = (next: Card[]) => {
    communityRef.current = next;
    setCommunity(next);
  };
  const commitPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const commitAction = (next: number) => {
    actionRef.current = next;
    setActionIndex(next);
  };

  const drawCard = () => deckRef.current.pop()!;
  const burnCard = () => { deckRef.current.pop(); };
  const totalPot = players.reduce((sum, player) => sum + player.contributed, 0);
  const currentPlayer = players[actionIndex];
  const amountToCall = currentPlayer ? Math.max(0, currentBetRef.current - currentPlayer.bet) : 0;
  const blindMultiplier = tournamentMode ? 2 ** Math.floor(Math.max(0, handNumber - 1) / 5) : 1;
  const smallBlind = SMALL_BLIND * blindMultiplier;
  const bigBlind = BIG_BLIND * blindMultiplier;
  const humanStrength = currentPlayer?.isHuman && currentPlayer.hand.length === 2
    ? (community.length >= 3 ? evaluateHand([...currentPlayer.hand, ...community]).name : currentPlayer.hand[0].value === currentPlayer.hand[1].value ? 'Pocket Pair' : currentPlayer.hand.some(card => card.value >= 13) ? 'High Cards' : 'Unmade Hand')
    : null;

  const announce = (playerId: number, action: string, line: string) => {
    setLastActions(current => ({ ...current, [playerId]: action }));
    setHistory(current => [line, ...current].slice(0, 12));
    setMessage(line);
  };

  const settleShowdown = (tablePlayers: Player[], board: Card[]) => {
    const next = tablePlayers.map((player) => ({ ...player }));
    const contenders = next.filter((player) => !player.folded);
    const ranks = new Map<number, HandRank>();
    contenders.forEach((player) => ranks.set(player.id, evaluateHand([...player.hand, ...board])));
    const levels = [...new Set(next.map((player) => player.contributed).filter((amount) => amount > 0))].sort((a, b) => a - b);
    let previousLevel = 0;
    const winnerIds = new Set<number>();

    for (const level of levels) {
      const involved = next.filter((player) => player.contributed >= level);
      const sidePot = (level - previousLevel) * involved.length;
      previousLevel = level;
      const eligible = involved.filter((player) => !player.folded);
      if (!eligible.length) continue;
      let best = ranks.get(eligible[0].id)!;
      for (const player of eligible.slice(1)) {
        const rank = ranks.get(player.id)!;
        if (compareRanks(rank, best) > 0) best = rank;
      }
      const winners = eligible.filter((player) => compareRanks(ranks.get(player.id)!, best) === 0);
      const share = Math.floor(sidePot / winners.length);
      let remainder = sidePot - share * winners.length;
      winners.forEach((winner) => {
        const target = next.find((player) => player.id === winner.id)!;
        target.stack += share + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        winnerIds.add(target.id);
      });
    }

    commitPlayers(next);
    commitAction(-1);
    commitPhase('SHOWDOWN');
    const winners = [...winnerIds].map((id) => next.find((player) => player.id === id)!);
    if (winners.length === 1) {
      const winner = winners[0];
      setMessage(`${winner.name} wins with ${ranks.get(winner.id)?.name}.`);
      setHistory(current => [`${winner.name} wins with ${ranks.get(winner.id)?.name}.`, ...current].slice(0, 12));
      setEmotes(current => ({ ...current, [winner.id]: '🏆' }));
    } else {
      setMessage(`${winners.map((winner) => winner.name).join(' and ')} split the pot.`);
    }
  };

  const runOutBoard = (tablePlayers: Player[], board: Card[]) => {
    const nextBoard = [...board];
    if (nextBoard.length === 0) {
      burnCard();
      nextBoard.push(drawCard(), drawCard(), drawCard());
    }
    if (nextBoard.length === 3) {
      burnCard();
      nextBoard.push(drawCard());
    }
    if (nextBoard.length === 4) {
      burnCard();
      nextBoard.push(drawCard());
    }
    setLastBoardCount(board.length);
    commitCommunity(nextBoard);
    settleShowdown(tablePlayers, nextBoard);
  };

  const awardUncontested = (tablePlayers: Player[]) => {
    const next = tablePlayers.map((player) => ({ ...player }));
    const winner = next.find((player) => !player.folded);
    const pot = next.reduce((sum, player) => sum + player.contributed, 0);
    if (winner) winner.stack += pot;
    commitPlayers(next);
    commitAction(-1);
    commitPhase('SHOWDOWN');
    setMessage(`${winner?.name ?? 'Last player'} wins ${pot} chips uncontested.`);
  };

  const advanceStreet = (tablePlayers: Player[]) => {
    const resetPlayers = tablePlayers.map((player) => ({ ...player, bet: 0 }));
    currentBetRef.current = 0;
    let nextBoard = [...communityRef.current];
    let nextPhase: Phase;
    setLastBoardCount(nextBoard.length);

    if (phaseRef.current === 'PREFLOP') {
      burnCard();
      nextBoard = [...nextBoard, drawCard(), drawCard(), drawCard()];
      nextPhase = 'FLOP';
    } else if (phaseRef.current === 'FLOP') {
      burnCard();
      nextBoard = [...nextBoard, drawCard()];
      nextPhase = 'TURN';
    } else if (phaseRef.current === 'TURN') {
      burnCard();
      nextBoard = [...nextBoard, drawCard()];
      nextPhase = 'RIVER';
    } else {
      commitPlayers(resetPlayers);
      settleShowdown(resetPlayers, nextBoard);
      return;
    }

    commitPlayers(resetPlayers);
    commitCommunity(nextBoard);
    commitPhase(nextPhase);
    const ableToAct = resetPlayers.filter((player) => !player.folded && !player.allIn);
    if (ableToAct.length <= 1) {
      runOutBoard(resetPlayers, nextBoard);
      return;
    }
    pendingRef.current = new Set(ableToAct.map((player) => player.id));
    const first = nextIndex(dealerRef.current, resetPlayers, (player) => pendingRef.current.has(player.id));
    commitAction(first);
    setMessage(`${nextPhase}: ${resetPlayers[first].name} acts first.`);
  };

  const handleAction = (action: Action) => {
    const actorIndex = actionRef.current;
    if (actorIndex < 0 || phaseRef.current === 'SETUP' || phaseRef.current === 'SHOWDOWN') return;
    const next = playersRef.current.map((player) => ({ ...player }));
    const actor = next[actorIndex];
    if (!actor || actor.folded || actor.allIn) return;
    const callAmount = Math.max(0, currentBetRef.current - actor.bet);

    if (action === 'fold') {
      actor.folded = true;
      announce(actor.id, 'FOLD', `${actor.name} folds.`);
      setEmotes(current => ({ ...current, [actor.id]: '😑' }));
    } else if (action === 'all-in') {
      const contribution = actor.stack;
      actor.stack = 0;
      actor.bet += contribution;
      actor.contributed += contribution;
      actor.allIn = true;
      if (actor.bet > currentBetRef.current) {
        currentBetRef.current = actor.bet;
        pendingRef.current = new Set(next.filter(player => !player.folded && !player.allIn && player.id !== actor.id).map(player => player.id));
      }
      announce(actor.id, 'ALL IN', `${actor.name} moves all in for ${actor.bet}.`);
      setEmotes(current => ({ ...current, [actor.id]: '🔥' }));
    } else if (action === 'raise' && actor.stack >= callAmount + BIG_BLIND) {
      const desiredBet = currentBetRef.current + Math.max(bigBlind, raiseAmount);
      const contribution = Math.min(actor.stack, desiredBet - actor.bet);
      actor.stack -= contribution;
      actor.bet += contribution;
      actor.contributed += contribution;
      actor.allIn = actor.stack === 0;
      if (actor.bet > currentBetRef.current) {
        currentBetRef.current = actor.bet;
        pendingRef.current = new Set(next.filter((player) => !player.folded && !player.allIn && player.id !== actor.id).map((player) => player.id));
        announce(actor.id, 'RAISE', `${actor.name} raises to ${actor.bet}.`);
      }
    } else {
      const contribution = Math.min(actor.stack, callAmount);
      actor.stack -= contribution;
      actor.bet += contribution;
      actor.contributed += contribution;
      actor.allIn = actor.stack === 0;
      announce(actor.id, callAmount === 0 ? 'CHECK' : 'CALL', callAmount === 0 ? `${actor.name} checks.` : `${actor.name} calls ${contribution}.`);
    }

    pendingRef.current.delete(actor.id);
    commitPlayers(next);
    const contenders = next.filter((player) => !player.folded);
    if (contenders.length === 1) {
      awardUncontested(next);
      return;
    }
    const pending = next.filter((player) => pendingRef.current.has(player.id) && !player.folded && !player.allIn);
    if (pending.length === 0) {
      advanceStreet(next);
      return;
    }
    const nextActor = nextIndex(actorIndex, next, (player) => pendingRef.current.has(player.id) && !player.folded && !player.allIn);
    commitAction(nextActor);
  };
  actionHandlerRef.current = handleAction;

  const startTable = () => {
    const tablePlayers: Player[] = Array.from({ length: 4 }, (_, index) => ({
      id: index,
      name: index < humanCount ? names[index].trim() || `Player ${index + 1}` : `CPU ${index + 1}`,
      isHuman: index < humanCount,
      hand: [],
      stack: STARTING_STACK,
      bet: 0,
      contributed: 0,
      folded: false,
      allIn: false
    }));
    dealerRef.current = -1;
    setDealerIndex(-1);
    setHandNumber(0);
    commitPlayers(tablePlayers);
    playersRef.current = tablePlayers;
    startHand(tablePlayers);
  };

  const startHand = (sourcePlayers = playersRef.current) => {
    const funded = sourcePlayers.filter((player) => player.stack >= bigBlind);
    if (funded.length < 2) {
      commitPhase('SHOWDOWN');
      commitAction(-1);
      setMessage('Not enough funded seats. Buy back in or start a new table.');
      return;
    }
    const next = sourcePlayers.map((player) => ({
      ...player,
      hand: [],
      bet: 0,
      contributed: 0,
      folded: player.stack < bigBlind,
      allIn: false
    }));
    const dealer = nextIndex(dealerRef.current, next, (player) => !player.folded);
    dealerRef.current = dealer;
    setDealerIndex(dealer);
    const activeCount = next.filter((player) => !player.folded).length;
    // Heads-up is the exception: the dealer posts the small blind.
    const smallBlindIndex = activeCount === 2 ? dealer : nextIndex(dealer, next, (player) => !player.folded);
    const bigBlindIndex = nextIndex(smallBlindIndex, next, (player) => !player.folded);
    setSmallBlindIndex(smallBlindIndex);
    setBigBlindIndex(bigBlindIndex);
    deckRef.current = createDeck();
    commitCommunity([]);
    setLastBoardCount(0);

    let dealIndex = smallBlindIndex;
    for (let pass = 0; pass < 2; pass += 1) {
      for (let count = 0; count < activeCount; count += 1) {
        if (!next[dealIndex].folded) next[dealIndex].hand.push(drawCard());
        dealIndex = nextIndex(dealIndex, next, (player) => !player.folded);
      }
    }

    const postBlind = (index: number, amount: number) => {
      const paid = Math.min(next[index].stack, amount);
      next[index].stack -= paid;
      next[index].bet += paid;
      next[index].contributed += paid;
      next[index].allIn = next[index].stack === 0;
    };
    postBlind(smallBlindIndex, smallBlind);
    postBlind(bigBlindIndex, bigBlind);
    currentBetRef.current = next[bigBlindIndex].bet;
    pendingRef.current = new Set(next.filter((player) => !player.folded && !player.allIn).map((player) => player.id));
    const firstActor = nextIndex(bigBlindIndex, next, (player) => pendingRef.current.has(player.id));
    commitPlayers(next);
    commitPhase('PREFLOP');
    commitAction(firstActor);
    setHandNumber((number) => number + 1);
    setLastActions({}); setEmotes({});
    setRaiseAmount(bigBlind);
    setHistory(current => [`Hand ${handNumber + 1} dealt · blinds ${smallBlind}/${bigBlind}`, ...current].slice(0, 12));
    setMessage(`${next[smallBlindIndex].name} posts ${smallBlind}; ${next[bigBlindIndex].name} posts ${bigBlind}.`);
  };

  const buyIn = (playerId: number) => {
    const next = playersRef.current.map((player) => player.id === playerId
      ? { ...player, stack: STARTING_STACK, folded: false, allIn: false, bet: 0, contributed: 0, hand: [] }
      : player);
    commitPlayers(next);
    const player = next.find((candidate) => candidate.id === playerId)!;
    setHistory(current => [`${player.name} bought back in for ${STARTING_STACK}.`, ...current].slice(0, 12));
    setMessage(`${player.name} is back in with ${STARTING_STACK} chips.`);
  };

  useEffect(() => {
    const actor = players[actionIndex];
    if (!actor || actor.isHuman || phase === 'SETUP' || phase === 'SHOWDOWN') return;
    const timer = window.setTimeout(() => {
      const toCall = Math.max(0, currentBetRef.current - actor.bet);
      const rank = community.length >= 3 ? evaluateHand([...actor.hand, ...community]) : null;
      const pairedHole = actor.hand[0]?.value === actor.hand[1]?.value;
      const strong = Boolean((rank && rank.category >= 2) || pairedHole || actor.hand.some((card) => card.value >= 13));
      const pressure = toCall / Math.max(1, actor.stack);
      let action: Action = 'check-call';
      const foldChance = cpuDifficulty === 'Casual' ? .35 : cpuDifficulty === 'Expert' ? .78 : .65;
      const raiseChance = cpuDifficulty === 'Casual' ? .16 : cpuDifficulty === 'Expert' ? .42 : .28;
      if (toCall > 0 && !strong && pressure > 0.18 && Math.random() < foldChance) action = 'fold';
      else if (strong && actor.stack >= toCall + bigBlind && Math.random() < raiseChance) action = 'raise';
      actionHandlerRef.current(action);
    }, 650 + Math.random() * 450);
    return () => window.clearTimeout(timer);
  }, [actionIndex, bigBlind, community, cpuDifficulty, phase, players]);

  const seatPositions = ['bottom', 'left', 'top', 'right'];
  const boardCards = Array.from({ length: 5 }, (_, index) => community[index]);
  const humanTurn = Boolean(currentPlayer?.isHuman && phase !== 'SHOWDOWN');

  return (
    <section className={`holdem-game theme-${tableTheme.toLowerCase()}`} aria-label="Four-seat Texas Hold'em">
      {phase === 'SETUP' ? (
        <div className="holdem-setup">
          <div className="holdem-kicker">LOCAL TABLE</div>
          <h2>Texas Hold’em</h2>
          <p>Seat up to four local players. Empty seats are filled by computer players.</p>
          <div className="holdem-options">
            <label>CPU <select value={cpuDifficulty} onChange={event => setCpuDifficulty(event.target.value as typeof cpuDifficulty)}><option>Casual</option><option>Sharp</option><option>Expert</option></select></label>
            <label>Felt <select value={tableTheme} onChange={event => setTableTheme(event.target.value as typeof tableTheme)}><option>Classic</option><option>Midnight</option><option>Royal</option></select></label>
            <button type="button" className={practiceInfo ? 'active' : ''} onClick={() => setPracticeInfo(value => !value)}>Practice info</button>
            <button type="button" className={tournamentMode ? 'active' : ''} onClick={() => setTournamentMode(value => !value)}>Tournament blinds</button>
          </div>
          <label>HUMAN PLAYERS</label>
          <div className="human-count">
            {[1, 2, 3, 4].map((count) => (
              <button key={count} type="button" className={humanCount === count ? 'active' : ''} onClick={() => setHumanCount(count)}>{count}</button>
            ))}
          </div>
          <div className="player-names">
            {Array.from({ length: humanCount }, (_, index) => (
              <input
                key={index}
                value={names[index]}
                aria-label={`Player ${index + 1} name`}
                onChange={(event) => setNames((current) => current.map((name, nameIndex) => nameIndex === index ? event.target.value : name))}
              />
            ))}
          </div>
          <button type="button" className="start-table" onClick={startTable}>START FOUR-SEAT TABLE</button>
          <small>500 table chips per seat · blinds 10 / 20 · local play</small>
        </div>
      ) : (
        <>
          <header className="holdem-header">
            <div><span>TABLE CHIPS</span><strong>HOLD’EM</strong></div>
            <div className="hand-meta"><span>HAND {handNumber}</span><span>{phase}</span><span>POT {totalPot}</span></div>
          </header>
          <div className="poker-room">
            <div className="poker-table">
              <div className="practice-deck" aria-hidden="true"><i /><i /><i /></div>
              {phase !== 'PREFLOP' && phase !== 'SHOWDOWN' && <div key={phase} className="street-splash">{phase}</div>}
              <div className="table-center">
                <div className="pot-display"><small>TOTAL POT</small><strong>{totalPot}</strong></div>
                <div className="community-row">
                  {boardCards.map((card, index) => (
                    <CardView key={card?.id ?? `slot-${index}`} card={card} newlyDealt={Boolean(card && index >= lastBoardCount)} dealDelay={(index - lastBoardCount) * 110} />
                  ))}
                </div>
                <div className="table-message" role="status">{message}</div>
              </div>
              {players.map((player, index) => {
                const isActing = index === actionIndex;
                const reveal = phase === 'SHOWDOWN' ? !player.folded : player.isHuman;
                const rank = phase === 'SHOWDOWN' && !player.folded ? evaluateHand([...player.hand, ...community]) : null;
                return (
                  <div key={player.id} className={`poker-seat ${seatPositions[index]}${isActing ? ' acting' : ''}${player.folded ? ' folded' : ''}`}>
                    {isActing && <div key={`${phase}-${player.id}-${lastActions[player.id] ?? ''}`} className="turn-indicator">{player.isHuman ? 'YOUR TURN' : `${player.name}’S TURN`}</div>}
                    {lastActions[player.id] && <div className="seat-action-pop">{lastActions[player.id]}</div>}
                    {emotes[player.id] && <div className="seat-emote">{emotes[player.id]}</div>}
                    <div className="seat-cards">
                      {player.hand.map((card, cardIndex) => <CardView key={card.id} card={card} hidden={!reveal} newlyDealt={phase === 'PREFLOP'} dealDelay={(cardIndex * players.length + index) * 85} />)}
                    </div>
                    <div className="seat-panel">
                      <div className="seat-name">
                        <strong>{player.name}</strong>
                        <span>{player.isHuman ? 'PLAYER' : 'CPU'}</span>
                      </div>
                      <div className="seat-stack">{player.stack}</div>
                      <div className="position-chips">
                        {index === dealerIndex && <i className="position-chip dealer-button" title="Dealer">D</i>}
                        {index === smallBlindIndex && <i className="position-chip small-blind-button" title="Small blind">SB</i>}
                        {index === bigBlindIndex && <i className="position-chip big-blind-button" title="Big blind">BB</i>}
                      </div>
                      <div className="seat-badges">
                        {player.bet > 0 && <em className="seat-bet">BET {player.bet}</em>}
                        {player.allIn && <em className="seat-state">ALL IN</em>}
                        {player.folded && <em className="seat-state">FOLDED</em>}
                        {rank && <em className="seat-rank">{rank.name}</em>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="holdem-controls">
            {phase === 'SHOWDOWN' ? (
              <>
                {players.filter(player => player.isHuman && player.stack < bigBlind).map(player => (
                  <button key={player.id} type="button" className="buy-in" onClick={() => buyIn(player.id)}>BUY IN {player.name} · {STARTING_STACK}</button>
                ))}
                <button type="button" className="new-hand" onClick={() => startHand()}>DEAL NEXT HAND</button>
                <button type="button" className="new-table" onClick={() => { commitPhase('SETUP'); setMessage('Choose how many local players are joining the table.'); }}>NEW TABLE</button>
              </>
            ) : humanTurn ? (
              <>
                {practiceInfo && humanStrength && <div className="practice-readout"><strong>{humanStrength}</strong><span>To call {amountToCall} · pot {totalPot}</span></div>}
                {amountToCall > 0 && <button type="button" className="fold" onClick={() => handleAction('fold')}>FOLD</button>}
                <button type="button" className="call" onClick={() => handleAction('check-call')}>
                  {amountToCall === 0 ? 'CHECK' : `CALL ${Math.min(amountToCall, currentPlayer.stack)}`}
                </button>
                <label className="raise-picker">RAISE +{raiseAmount}<input type="range" min={bigBlind} max={Math.max(bigBlind, currentPlayer.stack - amountToCall)} step={bigBlind} value={Math.min(raiseAmount, Math.max(bigBlind, currentPlayer.stack - amountToCall))} onChange={event => setRaiseAmount(Number(event.target.value))} /></label>
                <button type="button" className="raise" disabled={currentPlayer.stack < amountToCall + bigBlind} onClick={() => handleAction('raise')}>
                  RAISE TO {currentBetRef.current + raiseAmount}
                </button>
                <button type="button" className="all-in" onClick={() => handleAction('all-in')}>ALL IN {currentPlayer.stack}</button>
              </>
            ) : (
              <div className="cpu-thinking"><span /> {currentPlayer?.name ?? 'Table'} is thinking…</div>
            )}
          </div>
          <details className="hand-history"><summary>HAND HISTORY · {history.length}</summary>{history.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}</details>
        </>
      )}

      <style>{`
        .holdem-game{width:min(100%,1040px);margin:auto;padding:16px;color:#edf4f0;background:linear-gradient(150deg,#111b18,#18251f);border:1px solid #40584c;border-radius:20px;box-shadow:0 26px 75px rgba(0,0,0,.45);user-select:none}.holdem-setup{display:flex;flex-direction:column;align-items:center;gap:13px;max-width:520px;margin:35px auto;padding:28px;border:1px solid #395748;border-radius:18px;background:#0d1c16;text-align:center}.holdem-kicker{color:#d6ae4a;font-size:10px;font-weight:900;letter-spacing:.2em}.holdem-setup h2{margin:0;font-size:32px}.holdem-setup p{margin:0 0 8px;color:#96aa9f;font-size:13px}.holdem-setup label{color:#82978b;font-size:9px;font-weight:900;letter-spacing:.14em}.human-count{display:grid;grid-template-columns:repeat(4,52px);gap:7px}.human-count button{height:42px;border:1px solid #3b5548;border-radius:8px;background:#172a21;color:#9eb2a7;font-weight:900;cursor:pointer}.human-count button.active{border-color:#d2a944;background:#d2a944;color:#231b08}.player-names{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}.player-names input{min-width:0;padding:10px;border:1px solid #354e42;border-radius:7px;outline:none;background:#10221a;color:white}.start-table{width:100%;padding:14px;border:0;border-radius:9px;background:linear-gradient(#e2bd59,#bc8b27);box-shadow:0 5px 0 #6c4b12;color:#2b2008;font-weight:950;cursor:pointer}.holdem-setup small{color:#657c70}.holdem-header{display:flex;align-items:center;justify-content:space-between;padding:0 3px 12px}.holdem-header>div:first-child span,.holdem-header>div:first-child strong{display:block}.holdem-header>div:first-child span{color:#c9a747;font-size:8px;font-weight:900;letter-spacing:.18em}.holdem-header>div:first-child strong{font-size:23px}.hand-meta{display:flex;gap:7px}.hand-meta span{padding:5px 7px;border:1px solid #385346;border-radius:5px;background:#102018;color:#91a79a;font-size:9px;font-weight:850}.poker-room{position:relative;width:100%;overflow:hidden;border:1px solid #483c2a;border-radius:18px;background:radial-gradient(circle,#3d3021,#16120d);padding:18px}.poker-table{position:relative;width:100%;height:610px;border:14px solid #5d3e25;border-radius:46%;background:radial-gradient(ellipse,#17623e 0,#0d492d 54%,#083521 100%);box-shadow:inset 0 0 0 4px #b58a42,inset 0 0 55px rgba(0,0,0,.5),0 12px 25px rgba(0,0,0,.35)}.table-center{position:absolute;inset:36% 20% auto;display:flex;flex-direction:column;align-items:center;gap:8px}.pot-display{text-align:center}.pot-display small,.pot-display strong{display:block}.pot-display small{color:#86a993;font-size:7px;font-weight:900;letter-spacing:.14em}.pot-display strong{color:#edc65e;font-size:22px}.community-row{display:flex;gap:5px}.table-message{max-width:460px;min-height:27px;padding:6px 12px;border-radius:15px;background:rgba(3,20,12,.56);color:#d2dfd8;text-align:center;font-size:10px}.poker-seat{position:absolute;z-index:3;width:210px;transition:opacity .2s,filter .2s}.poker-seat.top{top:2%;left:50%;transform:translateX(-50%)}.poker-seat.bottom{bottom:2%;left:50%;transform:translateX(-50%)}.poker-seat.left{top:50%;left:1%;transform:translateY(-50%)}.poker-seat.right{top:50%;right:1%;transform:translateY(-50%)}.seat-cards{position:relative;z-index:2;display:flex;justify-content:center;gap:4px;height:74px}.seat-panel{position:relative;z-index:1;min-height:48px;margin-top:7px;padding:7px 10px;border:1px solid #486456;border-radius:9px;background:linear-gradient(#1a3026,#0d1d16);box-shadow:0 7px 14px rgba(0,0,0,.42)}.poker-seat.acting .seat-panel{border-color:#f0c75b;box-shadow:0 0 0 2px rgba(240,199,91,.22),0 0 20px rgba(240,199,91,.22)}.poker-seat.folded{opacity:.48;filter:grayscale(.65)}.seat-name{display:flex;justify-content:space-between;gap:8px}.seat-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.seat-name span{color:#718b7c;font-size:7px;font-weight:900}.seat-stack{margin-top:3px;color:#edc65e;font-size:14px;font-weight:900}.dealer-button{position:absolute;right:-9px;bottom:-9px;display:grid;place-items:center;width:23px;height:23px;border:2px solid #999;border-radius:50%;background:white;color:#222;font-size:10px;font-style:normal;font-weight:950}.seat-badges{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}.seat-bet,.seat-state,.seat-rank{display:inline-flex;padding:3px 6px;border-radius:4px;background:#d1a73c;color:#231a08;font-size:7px;font-style:normal;font-weight:950;white-space:nowrap}.seat-state{background:#b8434d;color:white}.seat-rank{background:#d9ece1;color:#153326}.holdem-card,.holdem-card-slot{position:relative;width:44px;height:62px;flex:0 0 auto;border-radius:5px}.holdem-card{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #d8d8d8;background:linear-gradient(145deg,#fff,#e8e8e8);box-shadow:0 3px 7px rgba(0,0,0,.45);color:#171717}.holdem-card>span{position:absolute;top:4px;left:5px;font-size:11px;font-weight:950}.holdem-card>strong{font-size:24px}.holdem-card .red{color:#cf2838}.holdem-card.hidden{border:3px solid #e7e2d6;background:repeating-linear-gradient(45deg,#732a31 0 4px,#a84249 4px 8px);color:#e7d9a9}.card-back-mark{display:grid;place-items:center;width:28px;height:40px;border:1px solid rgba(255,255,255,.45);font-size:9px;font-weight:950}.holdem-card-slot{border:1px dashed rgba(220,238,228,.18);background:rgba(0,0,0,.1)}.holdem-card.dealt{animation:deal-card .28s ease-out both}@keyframes deal-card{from{opacity:0;transform:translateY(-18px) scale(.86)}to{opacity:1;transform:none}}.holdem-controls{display:flex;justify-content:center;gap:9px;min-height:62px;padding-top:13px}.holdem-controls button{min-width:120px;padding:11px 16px;border:0;border-radius:9px;color:white;font-weight:950;cursor:pointer}.holdem-controls button:disabled{opacity:.4;cursor:not-allowed}.holdem-controls .fold{background:#9f3541}.holdem-controls .call,.holdem-controls .new-hand{background:#258257}.holdem-controls .raise{background:#b58225}.holdem-controls .new-table{background:#33483e}.cpu-thinking{display:flex;align-items:center;gap:9px;color:#99ada2;font-size:12px}.cpu-thinking span{width:8px;height:8px;border-radius:50%;background:#dfb84f;animation:thinking .9s infinite alternate}@keyframes thinking{to{opacity:.25;transform:scale(.65)}}@media(max-width:760px){.holdem-game{padding:10px}.poker-room{padding:8px}.poker-table{height:570px;border-width:9px;border-radius:38%}.poker-seat{width:154px}.poker-seat.left{left:0}.poker-seat.right{right:0}.table-center{inset:36% 8% auto}.holdem-card,.holdem-card-slot{width:36px;height:51px}.seat-cards{height:60px}.holdem-controls{flex-wrap:wrap}.holdem-controls button{min-width:95px;font-size:11px}}@media(max-width:470px){.poker-table{height:540px}.poker-seat{width:126px}.seat-panel{padding:6px}.seat-name span{display:none}.community-row{gap:2px}.holdem-card,.holdem-card-slot{width:31px;height:44px}.holdem-card>strong{font-size:18px}.holdem-card>span{font-size:9px}.table-center{inset:38% 1% auto}.hand-meta span:nth-child(2){display:none}.player-names{grid-template-columns:1fr}}
        .poker-seat.top,.poker-seat.bottom{display:flex;flex-direction:column}.poker-seat.top .seat-panel{order:-1;margin:0 0 7px}.poker-seat.left,.poker-seat.right{display:flex;align-items:center;width:246px;gap:8px}.poker-seat.left{flex-direction:row-reverse}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:142px;margin:0}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:96px;height:62px;flex:0 0 96px}.seat-cards{isolation:isolate}.seat-panel{isolation:isolate}.holdem-card{z-index:2;outline:1px solid rgba(255,255,255,.24)}
        @media(max-width:760px){.poker-seat.left,.poker-seat.right{width:184px;gap:5px}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:106px}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:73px;height:51px;flex-basis:73px}.poker-seat.left{left:-2px}.poker-seat.right{right:-2px}}
        @media(max-width:470px){.poker-seat.left,.poker-seat.right{width:150px;gap:3px}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:84px;padding:5px}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:63px;height:44px;flex-basis:63px}.poker-seat.left{left:-5px}.poker-seat.right{right:-5px}.seat-name strong{font-size:9px}.seat-stack{font-size:11px}.seat-badges{gap:2px}.seat-bet,.seat-state,.seat-rank{padding:2px 3px;font-size:6px}}
        .seat-cards{z-index:20!important;overflow:visible}.seat-panel{z-index:1!important}.holdem-card{z-index:21!important;overflow:hidden}.holdem-card>span{z-index:2;font-size:15px}.holdem-card>strong{z-index:1}.card-rank-bottom{position:absolute;z-index:2;right:5px;bottom:3px;transform:rotate(180deg);color:#171717;font-size:15px;font-weight:950;line-height:1}.card-rank-bottom.red{color:#cf2838}
        @media(max-width:760px){.holdem-card>span,.card-rank-bottom{font-size:13px}.holdem-card>span{top:3px;left:4px}.card-rank-bottom{right:4px;bottom:3px}}
        @media(max-width:470px){.holdem-card,.holdem-card-slot{width:36px;height:50px}.seat-cards{height:54px}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:75px;height:50px;flex-basis:75px}.poker-seat.left,.poker-seat.right{width:162px}.holdem-card>span,.card-rank-bottom{font-size:14px}.holdem-card>strong{font-size:21px}}
        /* Keep the side seats out of the shared-card lane. This prevents their
           hole cards from sitting on top of the community cards at every size. */
        .poker-seat.left,.poker-seat.right{flex-direction:column;align-items:center;width:158px;gap:3px}.poker-seat.left{left:2%;transform:translateY(-50%)}.poker-seat.right{right:2%;transform:translateY(-50%)}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:100%;margin:0}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{order:-1;width:76px;height:48px;flex:0 0 48px;transform:scale(.72);transform-origin:center}.table-center{left:23%;right:23%}
        @media(max-width:760px){.poker-seat.left,.poker-seat.right{width:112px;gap:1px}.poker-seat.left{left:1%}.poker-seat.right{right:1%}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:68px;height:42px;flex-basis:42px;transform:scale(.61)}.table-center{left:22%;right:22%}}
        @media(max-width:470px){.poker-seat.left,.poker-seat.right{width:92px}.poker-seat.left{left:0}.poker-seat.right{right:0}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:60px;height:36px;flex-basis:36px;transform:scale(.5)}.table-center{left:20%;right:20%}}
        .holdem-game.theme-midnight .poker-table{background:radial-gradient(ellipse,#203968,#122650 54%,#091633 100%);border-color:#192846}.holdem-game.theme-royal .poker-table{background:radial-gradient(ellipse,#722c43,#521b30 54%,#2b0c18 100%);border-color:#6f5422}.holdem-options{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}.holdem-options label,.holdem-options button{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px;border:1px solid #395748;border-radius:7px;background:#10221a;color:#9eb2a7;font-size:9px;font-weight:900}.holdem-options select{background:#08150f;color:white;border:0}.holdem-options button.active{border-color:#d2a944;color:#e8c65e}.seat-action-pop{position:absolute;z-index:35;left:50%;top:45%;transform:translate(-50%,-50%);padding:5px 8px;border-radius:6px;background:#e3b63f;color:#241a05;font-size:9px;font-weight:950;animation:action-pop .5s ease-out}.seat-emote{position:absolute;z-index:36;right:-5px;top:-8px;font-size:20px;filter:drop-shadow(0 4px 4px rgba(0,0,0,.6))}.practice-readout{display:grid;min-width:110px;padding:7px 10px;border:1px solid #3c6652;border-radius:8px;background:#10241b;color:#9cc9ae;font-size:9px}.practice-readout strong{color:#f0c85f;font-size:12px}.raise-picker{display:grid;min-width:120px;color:#94a89c;font-size:9px;font-weight:900}.raise-picker input{width:120px;accent-color:#d3aa42}.holdem-controls .all-in{background:#6e3ca1}.hand-history{margin-top:8px;padding:8px 11px;border:1px solid #314a3d;border-radius:8px;background:#0b1812;color:#82978b;font-size:9px}.hand-history summary{cursor:pointer;color:#d0ad4e;font-weight:900;letter-spacing:.1em}.hand-history div{padding:4px 0;border-top:1px solid rgba(255,255,255,.05)}@keyframes action-pop{from{opacity:0;transform:translate(-50%,-25%) scale(.65)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        /* Larger table, rotating position chips, and livelier dealing/turn feedback. */
        .holdem-game{width:min(100%,1160px)}.poker-table{height:720px}.table-center{top:38%}.holdem-card.dealt{animation:deal-card-enhanced .42s cubic-bezier(.18,.82,.28,1.15) both}.poker-seat.acting .seat-panel{animation:active-turn 1.15s ease-in-out infinite}.turn-indicator{position:absolute;z-index:40;left:50%;top:-9px;transform:translate(-50%,-100%);padding:4px 8px;border-radius:10px;background:#f0c75b;color:#251b05;font-size:7px;font-weight:950;letter-spacing:.08em;animation:turn-bounce .85s ease-in-out infinite alternate}.position-chips{position:absolute;right:-12px;bottom:-12px;z-index:8;display:flex;gap:3px}.position-chip{position:static;display:grid;place-items:center;width:27px;height:27px;border:2px solid #999;border-radius:50%;background:#fff;color:#222;font-size:8px;font-style:normal;font-weight:950;box-shadow:0 3px 7px rgba(0,0,0,.5);animation:chip-arrive .45s cubic-bezier(.2,.9,.3,1.25)}.small-blind-button{border-color:#55bde6;background:#d9f5ff;color:#07516d}.big-blind-button{border-color:#e2b33e;background:#fff1bb;color:#624500}.holdem-controls .buy-in{background:linear-gradient(#e2bd59,#b78120);color:#211805}@keyframes deal-card-enhanced{from{opacity:0;transform:translateY(-90px) rotate(-12deg) scale(.55)}to{opacity:1;transform:none}}@keyframes active-turn{50%{transform:scale(1.025);box-shadow:0 0 0 4px rgba(240,199,91,.18),0 0 30px rgba(240,199,91,.42)}}@keyframes turn-bounce{to{transform:translate(-50%,-115%) scale(1.06)}}@keyframes chip-arrive{from{opacity:0;transform:translate(20px,-20px) rotate(160deg) scale(.4)}}@media(max-width:760px){.poker-table{height:680px;border-radius:40%}.table-center{top:39%}}@media(max-width:470px){.poker-table{height:650px}.table-center{top:40%}}
        .practice-deck{position:absolute;z-index:2;left:50%;top:29%;width:42px;height:58px;transform:translateX(-50%)}.practice-deck i{position:absolute;inset:0;border:2px solid #eee8d8;border-radius:5px;background:repeating-linear-gradient(45deg,#732a31 0 4px,#a84249 4px 8px);box-shadow:0 4px 9px #0009}.practice-deck i:nth-child(2){transform:translate(3px,-3px)}.practice-deck i:nth-child(3){transform:translate(6px,-6px)}.street-splash{position:absolute;z-index:50;left:50%;top:50%;transform:translate(-50%,-50%);padding:10px 22px;border:2px solid #edc65e;border-radius:18px;background:#071b13e8;color:#edc65e;font-size:18px;font-weight:950;letter-spacing:.18em;pointer-events:none;animation:street-splash 1s ease-out forwards}.poker-seat.acting:after{content:'';position:absolute;z-index:-1;inset:-9px;border:2px solid #edc65e;border-radius:16px;animation:turn-ring 1s ease-in-out infinite}.seat-bet{animation:bet-chip-pop .45s cubic-bezier(.2,.9,.3,1.25)}@keyframes street-splash{0%{opacity:0;transform:translate(-50%,-30%) scale(.65)}25%{opacity:1;transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-70%) scale(1.08)}}@keyframes turn-ring{50%{inset:-15px;opacity:.2}}@keyframes bet-chip-pop{from{opacity:0;transform:translateY(18px) scale(.5)}}
        .holdem-card.dealt{animation-duration:.62s}.seat-cards .holdem-card.dealt{animation-name:practice-deal-hole}@keyframes practice-deal-hole{from{opacity:0;transform:translateY(-190px) rotate(-18deg) scale(.42)}70%{opacity:1;transform:translateY(5px) rotate(2deg) scale(1.04)}to{transform:none}}.community-row .holdem-card.dealt{animation-name:practice-deal-board}@keyframes practice-deal-board{from{opacity:0;transform:translateY(-110px) rotate(-10deg) scale(.5)}to{opacity:1;transform:none}}
        @media(max-width:470px){.practice-deck{top:30%;transform:translateX(-50%) scale(.82)}.street-splash{font-size:14px}.turn-indicator{font-size:6px}}
        @media(prefers-reduced-motion:reduce){.holdem-card.dealt,.poker-seat.acting .seat-panel,.poker-seat.acting:after,.turn-indicator,.position-chip,.street-splash,.seat-bet{animation:none}}
      `}</style>
    </section>
  );
};

export default TexasHoldemGame;
