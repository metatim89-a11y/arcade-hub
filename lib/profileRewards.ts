import { PlayerBadge, PlayerGameStat, ProfileFrameReward } from '../types';

export const COINS_PER_USD = 700;
export const SILVER_SPEND_COINS = 50 * COINS_PER_USD;
export const GOLD_SPEND_COINS = 100 * COINS_PER_USD;

export const BADGE_GAMES = [
  ['wheel', 'Spin Wheel'], ['crash', 'Crash'], ['blackjack', 'Blackjack'], ['poker', 'Holdem'],
  ['keno', 'Keno'], ['plinko', 'Plinko'], ['slots', 'Slots'], ['fishing', 'Ocean Hunter'],
  ['coinpusher', 'Coin Pusher'], ['worm', 'Worm.io'], ['connect4', 'Connect Four'],
  ['rubikscube', 'Color Recall'], ['mancala', 'Mancala'], ['rps', 'RPS Cards'],
  ['tictactoe', 'Tic Tac Toe'],
] as const;

export const PROFILE_FRAMES: ProfileFrameReward[] = [
  { name: 'Diamond Legend', minimumLevel: 20, color: '#a5f3fc', glow: 'rgba(34,211,238,.65)', background: 'linear-gradient(135deg,#67e8f9,#a78bfa,#f0abfc)' },
  { name: 'Platinum Elite', minimumLevel: 10, color: '#e2e8f0', glow: 'rgba(226,232,240,.55)', background: 'linear-gradient(135deg,#94a3b8,#f8fafc,#64748b)' },
  { name: 'Gold Champion', minimumLevel: 6, color: '#fde047', glow: 'rgba(250,204,21,.55)', background: 'linear-gradient(135deg,#a16207,#fde047,#ca8a04)' },
  { name: 'Silver Player', minimumLevel: 3, color: '#d1d5db', glow: 'rgba(209,213,219,.45)', background: 'linear-gradient(135deg,#64748b,#e5e7eb,#94a3b8)' },
  { name: 'Copper Rookie', minimumLevel: 1, color: '#fb923c', glow: 'rgba(180,83,9,.45)', background: 'linear-gradient(135deg,#7c2d12,#fdba74,#9a3412)' },
];

export const profileFrameForLevel = (level: number) => PROFILE_FRAMES.find((frame) => level >= frame.minimumLevel) ?? PROFILE_FRAMES[PROFILE_FRAMES.length - 1];

export const earnedBadges = (stats: PlayerGameStat[]): PlayerBadge[] => {
  const byGame = new Map(stats.map((stat) => [stat.gameId, stat]));
  const badges: PlayerBadge[] = BADGE_GAMES.flatMap(([gameId, label]) => {
    const plays = byGame.get(gameId)?.playCount ?? 0;
    return plays >= 25 ? [{
      id: `game-${gameId}`,
      name: `${label} Player`,
      description: `Played ${label} at least 25 times.`,
      icon: '🎮',
      tier: 'game' as const,
    }] : [];
  });
  const everyGame25 = BADGE_GAMES.every(([gameId]) => (byGame.get(gameId)?.playCount ?? 0) >= 25);
  const gamesAt50Usd = BADGE_GAMES.filter(([gameId]) => (byGame.get(gameId)?.coinsSpent ?? 0) >= SILVER_SPEND_COINS).length;
  const gamesAt100Usd = BADGE_GAMES.filter(([gameId]) => (byGame.get(gameId)?.coinsSpent ?? 0) >= GOLD_SPEND_COINS).length;

  if (everyGame25) badges.push({ id: 'copper-all-games', name: 'Copper All-Game Player', description: 'Played every arcade game at least 25 times.', icon: '🥉', tier: 'copper' });
  if (gamesAt50Usd >= 6) badges.push({ id: 'silver-six-games', name: 'Silver Arcade Player', description: 'Spent 35,000 game coins ($50 base value) in at least six games.', icon: '🥈', tier: 'silver' });
  if (gamesAt100Usd >= 6) badges.push({ id: 'gold-six-games', name: 'Gold Arcade Player', description: 'Spent 70,000 game coins ($100 base value) in at least six games.', icon: '🥇', tier: 'gold' });
  if (BADGE_GAMES.every(([gameId]) => (byGame.get(gameId)?.coinsSpent ?? 0) >= GOLD_SPEND_COINS)) badges.push({ id: 'platinum-all-games', name: 'Platinum Arcade Master', description: 'Spent 70,000 game coins ($100 base value) in every game.', icon: '💠', tier: 'platinum' });
  return badges;
};
