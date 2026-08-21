export const dailyFaucetAmountForLevel = (level: number) => {
  if (level <= 1) return 535;
  if (level === 2) return 615;
  if (level === 3) return 670;
  if (level === 4) return 725;
  if (level === 5) return 875;
  if (level === 6) return 1025;
  if (level === 7) return 1243;
  if (level === 8) return 1460;
  if (level === 9) return 1960;
  return 2460;
};

// Users can claim this every 4 and 3/4 minutes now
export const DAILY_FAUCET_COOLDOWN_MS = 285000;
