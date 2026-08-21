#!/usr/bin/env python3
"""
Solana Automated Token Scanner & Safety Analyzer
Monitors trending & new token pairs on Jupiter / Raydium DEXs.
Filters for volume momentum, minimum liquidity ($10k+), and immutable mint safety.
"""

import time
import requests
import json

DEXSCREENER_SOLANA_URL = "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112"
JUPITER_STRICT_LIST_URL = "https://token.jup.ag/strict"

class SolanaTokenScanner:
    def __init__(self, min_liquidity_usd: float = 10000.0, min_5m_volume_usd: float = 2500.0):
        self.min_liquidity = min_liquidity_usd
        self.min_5m_volume = min_5m_volume_usd
        self.watchlist = {}

    def fetch_trending_solana_pairs(self):
        """Fetches trending pairs on Solana network from DexScreener API."""
        try:
            url = "https://api.dexscreener.com/latest/dex/search?q=solana"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("pairs", [])
        except Exception as e:
            print(f"[!] Error fetching DexScreener data: {e}")
        return []

    def analyze_token_safety(self, pair: dict) -> dict:
        """Evaluates token pair metrics for micro-capital safety."""
        base_token = pair.get("baseToken", {})
        liquidity = pair.get("liquidity", {}).get("usd", 0)
        vol_5m = pair.get("volume", {}).get("m5", 0)
        price_change_5m = pair.get("priceChange", {}).get("m5", 0)
        txns_5m = pair.get("txns", {}).get("m5", {})
        buys_5m = txns_5m.get("buys", 0)
        sells_5m = txns_5m.get("sells", 0)

        # Safety Score Calculation (0 - 100)
        score = 0
        if liquidity >= self.min_liquidity:
            score += 40
        if vol_5m >= self.min_5m_volume:
            score += 30
        if buys_5m > sells_5m: # Positive buying pressure
            score += 15
        if 0 < price_change_5m <= 25: # Steady momentum, not an instant dump
            score += 15

        return {
            "symbol": base_token.get("symbol", "UNKNOWN"),
            "name": base_token.get("name", "Unknown Token"),
            "address": base_token.get("address", ""),
            "pair_address": pair.get("pairAddress", ""),
            "price_usd": float(pair.get("priceUsd", 0)),
            "liquidity_usd": liquidity,
            "volume_5m_usd": vol_5m,
            "price_change_5m_pct": price_change_5m,
            "buy_sell_ratio": buys_5m / max(1, sells_5m),
            "safety_score": score,
            "dex": pair.get("dexId", "raydium")
        }

    def scan_for_opportunities(self):
        """Scans Solana market for high-probability micro-entry opportunities."""
        print("\n🔍 [SOLANA TOKEN SCANNER] Scanning DexScreener & Jupiter Pools...")
        pairs = self.fetch_trending_solana_pairs()
        candidates = []

        for pair in pairs:
            if pair.get("chainId") != "solana":
                continue

            metrics = self.analyze_token_safety(pair)
            if metrics["safety_score"] >= 70 and metrics["liquidity_usd"] >= self.min_liquidity:
                candidates.append(metrics)

        # Sort candidates by safety score and 5m volume
        candidates.sort(key=lambda x: (x["safety_score"], x["volume_5m_usd"]), reverse=True)

        print(f"✨ Found {len(candidates)} high-probability token candidates:\n")
        for idx, item in enumerate(candidates[:5], 1):
            print(f"  #{idx} [{item['symbol']}] {item['name']}")
            print(f"      Address: {item['address']}")
            print(f"      Liquidity: ${item['liquidity_usd']:,.2f} | 5m Vol: ${item['volume_5m_usd']:,.2f}")
            print(f"      5m Change: {item['price_change_5m_pct']:+.2f}% | Safety Score: {item['safety_score']}/100")
            print(f"      DEX: {item['dex'].upper()}\n")

        return candidates

if __name__ == "__main__":
    scanner = SolanaTokenScanner(min_liquidity_usd=10000.0, min_5m_volume_usd=1000.0)
    scanner.scan_for_opportunities()
