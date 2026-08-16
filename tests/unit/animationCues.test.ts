import { describe, expect, it } from 'vitest';
import { classifyCardMotion, getBetFlights, getBlackjackDealDelay, getHoldemAnimationCue } from '../../lib/animationCues';

describe('card animation cues', () => {
  it('deals a newly mounted card only once', () => {
    expect(classifyCardMotion(undefined, 'visible')).toBe('deal');
    expect(classifyCardMotion('visible', 'visible')).toBe('none');
  });

  it('reveals only a face-down card becoming visible', () => {
    expect(classifyCardMotion('hidden', 'visible')).toBe('reveal');
    expect(classifyCardMotion('visible', 'hidden')).toBe('none');
  });

  it('alternates the opening Blackjack deal and deals later hits immediately', () => {
    expect([
      getBlackjackDealDelay('player', 0, true),
      getBlackjackDealDelay('dealer', 0, true),
      getBlackjackDealDelay('player', 1, true),
      getBlackjackDealDelay('dealer', 1, true),
    ]).toEqual([0, 110, 220, 330]);
    expect(getBlackjackDealDelay('player', 2, false)).toBe(0);
  });
});

describe('online Hold’em animation cues', () => {
  const previous = { hand: 7, boardCount: 0, actor: 1 };

  it('distinguishes a new hand, street, and turn', () => {
    expect(getHoldemAnimationCue(null, previous)).toBe('deal');
    expect(getHoldemAnimationCue(previous, { ...previous, boardCount: 3 })).toBe('street');
    expect(getHoldemAnimationCue(previous, { ...previous, actor: 2 })).toBe('turn');
  });

  it('does not animate a server refresh with no gameplay change', () => {
    expect(getHoldemAnimationCue(previous, { ...previous })).toBeNull();
  });

  it('flies only newly committed chips and uses the delta', () => {
    expect(getBetFlights(
      [{ id: 'tim', bet: 25 }, { id: 'cpu', bet: 50 }],
      [{ id: 'tim', bet: 75 }, { id: 'cpu', bet: 50 }],
    )).toEqual([{ playerId: 'tim', amount: 50 }]);
  });

  it('does not fly chips when bets reset for a new street', () => {
    expect(getBetFlights([{ id: 'tim', bet: 75 }], [{ id: 'tim', bet: 0 }])).toEqual([]);
  });
});
