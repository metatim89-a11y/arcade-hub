import { describe, expect, it } from 'vitest';
import { resolveBlindPositions } from '../../lib/holdemPositions';

const player = (dealt = true, folded = false) => ({ hand: dealt ? [{ rank: 'A' }] : [], folded });

describe('resolveBlindPositions', () => {
  it('keeps server-owned positions after players fold', () => {
    const positions = resolveBlindPositions(
      [player(true, true), player(true), player(true, true), player(true)],
      0,
      1,
      2,
    );
    expect(positions).toEqual({ smallBlindSeat: 1, bigBlindSeat: 2 });
  });

  it('uses dealt hand membership instead of mutable fold state for older snapshots', () => {
    const positions = resolveBlindPositions(
      [player(true), player(true, true), player(false), player(true)],
      0,
    );
    expect(positions).toEqual({ smallBlindSeat: 1, bigBlindSeat: 3 });
  });

  it('uses the dealer as small blind when only two seats were dealt in', () => {
    const positions = resolveBlindPositions([player(true), player(false), player(true)], 2);
    expect(positions).toEqual({ smallBlindSeat: 2, bigBlindSeat: 0 });
  });
});
