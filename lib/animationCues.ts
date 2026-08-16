export type CardMotion = 'deal' | 'reveal' | 'none';

export type HoldemAnimationCue = 'deal' | 'street' | 'turn' | null;

export interface HoldemAnimationSnapshot {
  hand: number;
  boardCount: number;
  actor: number;
}

export interface BetSnapshot {
  id: string;
  bet: number;
}

export interface BetFlight {
  playerId: string;
  amount: number;
}

export const getBlackjackDealDelay = (lane: 'player' | 'dealer', cardIndex: number, openingDeal: boolean) => (
  openingDeal ? cardIndex * 220 + (lane === 'dealer' ? 110 : 0) : 0
);

export const classifyCardMotion = (previousState: string | undefined, nextState: string): CardMotion => {
  if (previousState === undefined) return 'deal';
  if (previousState === 'hidden' && nextState === 'visible') return 'reveal';
  return 'none';
};

export const getHoldemAnimationCue = (
  previous: HoldemAnimationSnapshot | null,
  next: HoldemAnimationSnapshot,
): HoldemAnimationCue => {
  if (!previous || previous.hand !== next.hand) return 'deal';
  if (previous.boardCount !== next.boardCount) return 'street';
  if (previous.actor !== next.actor) return 'turn';
  return null;
};

export const getBetFlights = (previous: BetSnapshot[], next: BetSnapshot[]): BetFlight[] => {
  const priorBets = new Map(previous.map((player) => [player.id, player.bet]));
  return next.flatMap((player) => {
    const prior = priorBets.get(player.id) ?? 0;
    return player.bet > prior ? [{ playerId: player.id, amount: player.bet - prior }] : [];
  });
};
