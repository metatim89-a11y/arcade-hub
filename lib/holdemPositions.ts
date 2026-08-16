export type HoldemPositionPlayer = { hand: unknown[]; folded: boolean };

const nextDealtSeat = (from: number, players: HoldemPositionPlayer[]) => {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const seat = (from + offset) % players.length;
    if (players[seat]?.hand.length) return seat;
  }
  return -1;
};

export const resolveBlindPositions = (
  players: HoldemPositionPlayer[],
  dealer: number,
  serverSmallBlind?: number,
  serverBigBlind?: number,
) => {
  if (Number.isInteger(serverSmallBlind) && Number.isInteger(serverBigBlind) && serverSmallBlind! >= 0 && serverBigBlind! >= 0) {
    return { smallBlindSeat: serverSmallBlind!, bigBlindSeat: serverBigBlind! };
  }

  // Hand membership stays stable after a fold; folded status does not.
  const dealtCount = players.filter((player) => player.hand.length > 0).length;
  const smallBlindSeat = dealtCount === 2 ? dealer : nextDealtSeat(dealer, players);
  return { smallBlindSeat, bigBlindSeat: nextDealtSeat(smallBlindSeat, players) };
};
