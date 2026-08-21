export const dailyFaucetAmountForLevel = (level: number) => {
  if (level <= 1) return 75;
  if (level === 2) return 155;
  if (level === 3) return 210;
  if (level === 4) return 265;
  if (level === 5) return 415;
  if (level === 6) return 565;
  if (level === 7) return 783;
  if (level === 8) return 1000;
  if (level === 9) return 1500;
  return 2000;
};

// Users can claim this every 4 and 3/4 minutes now
export const DAILY_FAUCET_COOLDOWN_MS = 285000;
