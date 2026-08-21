export interface TokenCandidate {
  symbol: string;
  name: string;
  address: string;
  priceUsd: number;
  liquidityUsd: number;
  volume5mUsd: number;
  priceChange5mPct: number;
  safetyScore: number;
  dex: string;
}

const DEXSCREENER_SEARCH_URL = 'https://api.dexscreener.com/latest/dex/search?q=solana';

export async function fetchSolanaOpportunities(minLiquidity: number = 10000): Promise<TokenCandidate[]> {
  try {
    const res = await fetch(DEXSCREENER_SEARCH_URL);
    if (!res.ok) return [];

    const data = await res.json();
    const pairs = data.pairs || [];

    const candidates: TokenCandidate[] = [];

    for (const pair of pairs) {
      if (pair.chainId !== 'solana') continue;

      const baseToken = pair.baseToken || {};
      const liquidity = pair.liquidity?.usd || 0;
      const vol5m = pair.volume?.m5 || 0;
      const change5m = pair.priceChange?.m5 || 0;
      const txns5m = pair.txns?.m5 || {};
      const buys = txns5m.buys || 0;
      const sells = txns5m.sells || 0;

      if (liquidity < minLiquidity) continue;

      let score = 0;
      if (liquidity >= 25000) score += 40; else score += 20;
      if (vol5m >= 2500) score += 30; else score += 15;
      if (buys > sells) score += 15;
      if (change5m > 0 && change5m <= 30) score += 15;

      if (score >= 60) {
        candidates.push({
          symbol: baseToken.symbol || 'TOKEN',
          name: baseToken.name || 'Solana Token',
          address: baseToken.address || '',
          priceUsd: Number(pair.priceUsd || 0),
          liquidityUsd: liquidity,
          volume5mUsd: vol5m,
          priceChange5mPct: change5m,
          safetyScore: score,
          dex: pair.dexId || 'raydium',
        });
      }
    }

    return candidates.sort((a, b) => b.safetyScore - a.safetyScore);
  } catch (error) {
    console.error('Error scanning Solana opportunities:', error);
    return [];
  }
}
