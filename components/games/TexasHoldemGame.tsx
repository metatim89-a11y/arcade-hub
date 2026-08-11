import React, { useEffect, useRef, useState } from 'react';

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
type Phase = 'SETUP' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
type Action = 'fold' | 'check-call' | 'raise';

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

const CardView: React.FC<{ card?: Card; hidden?: boolean; newlyDealt?: boolean }> = ({ card, hidden = false, newlyDealt = false }) => {
  if (!card) return <div className="holdem-card-slot" aria-hidden="true" />;
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`holdem-card${newlyDealt ? ' dealt' : ''}${hidden ? ' hidden' : ''}`} aria-label={hidden ? 'Hidden card' : `${card.rank} of ${card.suit}`}>
      {hidden ? <div className="card-back-mark">AH</div> : (
        <>
          <span className={red ? 'red' : ''}>{card.rank}</span>
          <strong className={red ? 'red' : ''}>{card.suit}</strong>
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
  const [message, setMessage] = useState('Choose how many local players are joining the table.');
  const [handNumber, setHandNumber] = useState(0);
  const [lastBoardCount, setLastBoardCount] = useState(0);

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
      setMessage(`${actor.name} folds.`);
    } else if (action === 'raise' && actor.stack >= callAmount + BIG_BLIND) {
      const desiredBet = currentBetRef.current + BIG_BLIND;
      const contribution = Math.min(actor.stack, desiredBet - actor.bet);
      actor.stack -= contribution;
      actor.bet += contribution;
      actor.contributed += contribution;
      actor.allIn = actor.stack === 0;
      if (actor.bet > currentBetRef.current) {
        currentBetRef.current = actor.bet;
        pendingRef.current = new Set(next.filter((player) => !player.folded && !player.allIn && player.id !== actor.id).map((player) => player.id));
        setMessage(`${actor.name} raises to ${actor.bet}.`);
      }
    } else {
      const contribution = Math.min(actor.stack, callAmount);
      actor.stack -= contribution;
      actor.bet += contribution;
      actor.contributed += contribution;
      actor.allIn = actor.stack === 0;
      setMessage(callAmount === 0 ? `${actor.name} checks.` : `${actor.name} calls ${contribution}.`);
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
    const funded = sourcePlayers.filter((player) => player.stack >= BIG_BLIND);
    if (funded.length < 2) {
      commitPhase('SETUP');
      setMessage('Fewer than two funded seats remain. Start a new table.');
      return;
    }
    const next = sourcePlayers.map((player) => ({
      ...player,
      hand: [],
      bet: 0,
      contributed: 0,
      folded: player.stack < BIG_BLIND,
      allIn: false
    }));
    const dealer = nextIndex(dealerRef.current, next, (player) => !player.folded);
    dealerRef.current = dealer;
    setDealerIndex(dealer);
    const activeCount = next.filter((player) => !player.folded).length;
    // Heads-up is the exception: the dealer posts the small blind.
    const smallBlindIndex = activeCount === 2 ? dealer : nextIndex(dealer, next, (player) => !player.folded);
    const bigBlindIndex = nextIndex(smallBlindIndex, next, (player) => !player.folded);
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
    postBlind(smallBlindIndex, SMALL_BLIND);
    postBlind(bigBlindIndex, BIG_BLIND);
    currentBetRef.current = next[bigBlindIndex].bet;
    pendingRef.current = new Set(next.filter((player) => !player.folded && !player.allIn).map((player) => player.id));
    const firstActor = nextIndex(bigBlindIndex, next, (player) => pendingRef.current.has(player.id));
    commitPlayers(next);
    commitPhase('PREFLOP');
    commitAction(firstActor);
    setHandNumber((number) => number + 1);
    setMessage(`${next[smallBlindIndex].name} posts ${SMALL_BLIND}; ${next[bigBlindIndex].name} posts ${BIG_BLIND}.`);
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
      if (toCall > 0 && !strong && pressure > 0.18 && Math.random() < 0.65) action = 'fold';
      else if (strong && actor.stack >= toCall + BIG_BLIND && Math.random() < 0.28) action = 'raise';
      actionHandlerRef.current(action);
    }, 650 + Math.random() * 450);
    return () => window.clearTimeout(timer);
  }, [actionIndex, community, phase, players]);

  const seatPositions = ['bottom', 'left', 'top', 'right'];
  const boardCards = Array.from({ length: 5 }, (_, index) => community[index]);
  const humanTurn = Boolean(currentPlayer?.isHuman && phase !== 'SHOWDOWN');

  return (
    <section className="holdem-game" aria-label="Four-seat Texas Hold'em">
      {phase === 'SETUP' ? (
        <div className="holdem-setup">
          <div className="holdem-kicker">LOCAL TABLE</div>
          <h2>Texas Hold’em</h2>
          <p>Seat up to four local players. Empty seats are filled by computer players.</p>
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
              <div className="table-center">
                <div className="pot-display"><small>TOTAL POT</small><strong>{totalPot}</strong></div>
                <div className="community-row">
                  {boardCards.map((card, index) => (
                    <CardView key={card?.id ?? `slot-${index}`} card={card} newlyDealt={Boolean(card && index >= lastBoardCount)} />
                  ))}
                </div>
                <div className="table-message" role="status">{message}</div>
              </div>
              {players.map((player, index) => {
                const isActing = index === actionIndex;
                const reveal = phase === 'SHOWDOWN' ? !player.folded : player.isHuman && isActing;
                const rank = phase === 'SHOWDOWN' && !player.folded ? evaluateHand([...player.hand, ...community]) : null;
                return (
                  <div key={player.id} className={`poker-seat ${seatPositions[index]}${isActing ? ' acting' : ''}${player.folded ? ' folded' : ''}`}>
                    <div className="seat-cards">
                      {player.hand.map((card) => <CardView key={card.id} card={card} hidden={!reveal} />)}
                    </div>
                    <div className="seat-panel">
                      <div className="seat-name">
                        <strong>{player.name}</strong>
                        <span>{player.isHuman ? 'PLAYER' : 'CPU'}</span>
                      </div>
                      <div className="seat-stack">{player.stack}</div>
                      {index === dealerIndex && <i className="dealer-button">D</i>}
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
                <button type="button" className="new-hand" onClick={() => startHand()}>DEAL NEXT HAND</button>
                <button type="button" className="new-table" onClick={() => { commitPhase('SETUP'); setMessage('Choose how many local players are joining the table.'); }}>NEW TABLE</button>
              </>
            ) : humanTurn ? (
              <>
                {amountToCall > 0 && <button type="button" className="fold" onClick={() => handleAction('fold')}>FOLD</button>}
                <button type="button" className="call" onClick={() => handleAction('check-call')}>
                  {amountToCall === 0 ? 'CHECK' : `CALL ${Math.min(amountToCall, currentPlayer.stack)}`}
                </button>
                <button type="button" className="raise" disabled={currentPlayer.stack < amountToCall + BIG_BLIND} onClick={() => handleAction('raise')}>
                  RAISE TO {currentBetRef.current + BIG_BLIND}
                </button>
              </>
            ) : (
              <div className="cpu-thinking"><span /> {currentPlayer?.name ?? 'Table'} is thinking…</div>
            )}
          </div>
        </>
      )}

      <style>{`
        .holdem-game{width:min(100%,1040px);margin:auto;padding:16px;color:#edf4f0;background:linear-gradient(150deg,#111b18,#18251f);border:1px solid #40584c;border-radius:20px;box-shadow:0 26px 75px rgba(0,0,0,.45);user-select:none}.holdem-setup{display:flex;flex-direction:column;align-items:center;gap:13px;max-width:520px;margin:35px auto;padding:28px;border:1px solid #395748;border-radius:18px;background:#0d1c16;text-align:center}.holdem-kicker{color:#d6ae4a;font-size:10px;font-weight:900;letter-spacing:.2em}.holdem-setup h2{margin:0;font-size:32px}.holdem-setup p{margin:0 0 8px;color:#96aa9f;font-size:13px}.holdem-setup label{color:#82978b;font-size:9px;font-weight:900;letter-spacing:.14em}.human-count{display:grid;grid-template-columns:repeat(4,52px);gap:7px}.human-count button{height:42px;border:1px solid #3b5548;border-radius:8px;background:#172a21;color:#9eb2a7;font-weight:900;cursor:pointer}.human-count button.active{border-color:#d2a944;background:#d2a944;color:#231b08}.player-names{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}.player-names input{min-width:0;padding:10px;border:1px solid #354e42;border-radius:7px;outline:none;background:#10221a;color:white}.start-table{width:100%;padding:14px;border:0;border-radius:9px;background:linear-gradient(#e2bd59,#bc8b27);box-shadow:0 5px 0 #6c4b12;color:#2b2008;font-weight:950;cursor:pointer}.holdem-setup small{color:#657c70}.holdem-header{display:flex;align-items:center;justify-content:space-between;padding:0 3px 12px}.holdem-header>div:first-child span,.holdem-header>div:first-child strong{display:block}.holdem-header>div:first-child span{color:#c9a747;font-size:8px;font-weight:900;letter-spacing:.18em}.holdem-header>div:first-child strong{font-size:23px}.hand-meta{display:flex;gap:7px}.hand-meta span{padding:5px 7px;border:1px solid #385346;border-radius:5px;background:#102018;color:#91a79a;font-size:9px;font-weight:850}.poker-room{position:relative;width:100%;overflow:hidden;border:1px solid #483c2a;border-radius:18px;background:radial-gradient(circle,#3d3021,#16120d);padding:18px}.poker-table{position:relative;width:100%;height:610px;border:14px solid #5d3e25;border-radius:46%;background:radial-gradient(ellipse,#17623e 0,#0d492d 54%,#083521 100%);box-shadow:inset 0 0 0 4px #b58a42,inset 0 0 55px rgba(0,0,0,.5),0 12px 25px rgba(0,0,0,.35)}.table-center{position:absolute;inset:36% 20% auto;display:flex;flex-direction:column;align-items:center;gap:8px}.pot-display{text-align:center}.pot-display small,.pot-display strong{display:block}.pot-display small{color:#86a993;font-size:7px;font-weight:900;letter-spacing:.14em}.pot-display strong{color:#edc65e;font-size:22px}.community-row{display:flex;gap:5px}.table-message{max-width:460px;min-height:27px;padding:6px 12px;border-radius:15px;background:rgba(3,20,12,.56);color:#d2dfd8;text-align:center;font-size:10px}.poker-seat{position:absolute;z-index:3;width:210px;transition:opacity .2s,filter .2s}.poker-seat.top{top:2%;left:50%;transform:translateX(-50%)}.poker-seat.bottom{bottom:2%;left:50%;transform:translateX(-50%)}.poker-seat.left{top:50%;left:1%;transform:translateY(-50%)}.poker-seat.right{top:50%;right:1%;transform:translateY(-50%)}.seat-cards{position:relative;z-index:2;display:flex;justify-content:center;gap:4px;height:74px}.seat-panel{position:relative;z-index:1;min-height:48px;margin-top:7px;padding:7px 10px;border:1px solid #486456;border-radius:9px;background:linear-gradient(#1a3026,#0d1d16);box-shadow:0 7px 14px rgba(0,0,0,.42)}.poker-seat.acting .seat-panel{border-color:#f0c75b;box-shadow:0 0 0 2px rgba(240,199,91,.22),0 0 20px rgba(240,199,91,.22)}.poker-seat.folded{opacity:.48;filter:grayscale(.65)}.seat-name{display:flex;justify-content:space-between;gap:8px}.seat-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.seat-name span{color:#718b7c;font-size:7px;font-weight:900}.seat-stack{margin-top:3px;color:#edc65e;font-size:14px;font-weight:900}.dealer-button{position:absolute;right:-9px;bottom:-9px;display:grid;place-items:center;width:23px;height:23px;border:2px solid #999;border-radius:50%;background:white;color:#222;font-size:10px;font-style:normal;font-weight:950}.seat-badges{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}.seat-bet,.seat-state,.seat-rank{display:inline-flex;padding:3px 6px;border-radius:4px;background:#d1a73c;color:#231a08;font-size:7px;font-style:normal;font-weight:950;white-space:nowrap}.seat-state{background:#b8434d;color:white}.seat-rank{background:#d9ece1;color:#153326}.holdem-card,.holdem-card-slot{position:relative;width:44px;height:62px;flex:0 0 auto;border-radius:5px}.holdem-card{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #d8d8d8;background:linear-gradient(145deg,#fff,#e8e8e8);box-shadow:0 3px 7px rgba(0,0,0,.45);color:#171717}.holdem-card>span{position:absolute;top:4px;left:5px;font-size:11px;font-weight:950}.holdem-card>strong{font-size:24px}.holdem-card .red{color:#cf2838}.holdem-card.hidden{border:3px solid #e7e2d6;background:repeating-linear-gradient(45deg,#732a31 0 4px,#a84249 4px 8px);color:#e7d9a9}.card-back-mark{display:grid;place-items:center;width:28px;height:40px;border:1px solid rgba(255,255,255,.45);font-size:9px;font-weight:950}.holdem-card-slot{border:1px dashed rgba(220,238,228,.18);background:rgba(0,0,0,.1)}.holdem-card.dealt{animation:deal-card .28s ease-out both}@keyframes deal-card{from{opacity:0;transform:translateY(-18px) scale(.86)}to{opacity:1;transform:none}}.holdem-controls{display:flex;justify-content:center;gap:9px;min-height:62px;padding-top:13px}.holdem-controls button{min-width:120px;padding:11px 16px;border:0;border-radius:9px;color:white;font-weight:950;cursor:pointer}.holdem-controls button:disabled{opacity:.4;cursor:not-allowed}.holdem-controls .fold{background:#9f3541}.holdem-controls .call,.holdem-controls .new-hand{background:#258257}.holdem-controls .raise{background:#b58225}.holdem-controls .new-table{background:#33483e}.cpu-thinking{display:flex;align-items:center;gap:9px;color:#99ada2;font-size:12px}.cpu-thinking span{width:8px;height:8px;border-radius:50%;background:#dfb84f;animation:thinking .9s infinite alternate}@keyframes thinking{to{opacity:.25;transform:scale(.65)}}@media(max-width:760px){.holdem-game{padding:10px}.poker-room{padding:8px}.poker-table{height:570px;border-width:9px;border-radius:38%}.poker-seat{width:154px}.poker-seat.left{left:0}.poker-seat.right{right:0}.table-center{inset:36% 8% auto}.holdem-card,.holdem-card-slot{width:36px;height:51px}.seat-cards{height:60px}.holdem-controls{flex-wrap:wrap}.holdem-controls button{min-width:95px;font-size:11px}}@media(max-width:470px){.poker-table{height:540px}.poker-seat{width:126px}.seat-panel{padding:6px}.seat-name span{display:none}.community-row{gap:2px}.holdem-card,.holdem-card-slot{width:31px;height:44px}.holdem-card>strong{font-size:18px}.holdem-card>span{font-size:9px}.table-center{inset:38% 1% auto}.hand-meta span:nth-child(2){display:none}.player-names{grid-template-columns:1fr}}
        .poker-seat.top,.poker-seat.bottom{display:flex;flex-direction:column}.poker-seat.top .seat-panel{order:-1;margin:0 0 7px}.poker-seat.left,.poker-seat.right{display:flex;align-items:center;width:246px;gap:8px}.poker-seat.left{flex-direction:row-reverse}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:142px;margin:0}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:96px;height:62px;flex:0 0 96px}.seat-cards{isolation:isolate}.seat-panel{isolation:isolate}.holdem-card{z-index:2;outline:1px solid rgba(255,255,255,.24)}
        @media(max-width:760px){.poker-seat.left,.poker-seat.right{width:184px;gap:5px}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:106px}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:73px;height:51px;flex-basis:73px}.poker-seat.left{left:-2px}.poker-seat.right{right:-2px}}
        @media(max-width:470px){.poker-seat.left,.poker-seat.right{width:150px;gap:3px}.poker-seat.left .seat-panel,.poker-seat.right .seat-panel{width:84px;padding:5px}.poker-seat.left .seat-cards,.poker-seat.right .seat-cards{width:63px;height:44px;flex-basis:63px}.poker-seat.left{left:-5px}.poker-seat.right{right:-5px}.seat-name strong{font-size:9px}.seat-stack{font-size:11px}.seat-badges{gap:2px}.seat-bet,.seat-state,.seat-rank{padding:2px 3px;font-size:6px}}
      `}</style>
    </section>
  );
};

export default TexasHoldemGame;
