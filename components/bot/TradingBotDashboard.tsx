import React, { useEffect, useState } from 'react';
import GlassButton from '../ui/GlassButton';

interface TokenCandidate {
  symbol: string;
  name: string;
  address: string;
  priceUsd: number;
  liquidityUsd: number;
  volume5mUsd: number;
  change5mPct: number;
  safetyScore: number;
}

export default function TradingBotDashboard() {
  const [solPrice, setSolPrice] = useState(184.25);
  const [balanceUsdc, setBalanceUsdc] = useState(30.0);
  const [isBotActive, setIsBotActive] = useState(true);
  const [candidates, setCandidates] = useState<TokenCandidate[]>([
    {
      symbol: 'SOL',
      name: 'Solana Native',
      address: 'So11111111111111111111111111111111111111112',
      priceUsd: 184.25,
      liquidityUsd: 450000000,
      volume5mUsd: 1250000,
      change5mPct: 2.4,
      safetyScore: 98,
    },
    {
      symbol: 'JUP',
      name: 'Jupiter Exchange',
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      priceUsd: 1.12,
      liquidityUsd: 85000000,
      volume5mUsd: 340000,
      change5mPct: 4.8,
      safetyScore: 94,
    },
    {
      symbol: 'RAY',
      name: 'Raydium Protocol',
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      priceUsd: 2.45,
      liquidityUsd: 42000000,
      volume5mUsd: 180000,
      change5mPct: -1.2,
      safetyScore: 90,
    },
  ]);

  const [tradeLogs, setTradeLogs] = useState([
    {
      id: 1,
      type: 'DCA BUY',
      pair: 'SOL/USDC',
      amount: '$10.00 USDC',
      price: '$182.10',
      pnl: '+$0.12',
      status: 'OPEN',
      time: '12 mins ago',
    },
    {
      id: 2,
      type: 'TAKE PROFIT 🎯',
      pair: 'JUP/USDC',
      amount: '$10.00 USDC',
      price: '$1.12',
      pnl: '+$1.50 (+15%)',
      status: 'CLOSED_PROFIT',
      time: '1 hour ago',
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSolPrice((prev) => {
        const delta = (Math.random() - 0.48) * 0.8;
        return Number((prev + delta).toFixed(2));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-5xl px-4 py-6 text-white mx-auto gap-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-black uppercase">
              Solana Bot V1
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              Supabase Connected
            </span>
          </div>
          <h2 className="text-3xl font-black text-amber-300 mt-2">Solana Micro-Capital Trading Dashboard</h2>
          <p className="text-slate-400 text-xs mt-1">
            Autonomous Jupiter V6 DEX DCA &amp; Liquidity Spike Engine ($10 – $50 Capital Management)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <div className="text-[10px] text-slate-400 uppercase font-extrabold">SOL / USDC Price</div>
            <div className="text-xl font-black text-amber-300">${solPrice.toFixed(2)}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <div className="text-[10px] text-slate-400 uppercase font-extrabold">Bot Capital</div>
            <div className="text-xl font-black text-emerald-400">${balanceUsdc.toFixed(2)} USDC</div>
          </div>
          <GlassButton
            onClick={() => setIsBotActive((prev) => !prev)}
            className={`px-6 py-3 font-black ${
              isBotActive
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 border-emerald-300'
                : 'bg-red-900/50 text-red-200 border-red-500/40'
            }`}
          >
            {isBotActive ? '⚡ BOT RUNNING' : '⏸️ BOT PAUSED'}
          </GlassButton>
        </div>
      </div>

      {/* Grid: Token Scanner & Risk Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Token Scanner */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
              🔍 Solana Token Scanner
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-bold">
              Raydium + Jupiter Pools
            </span>
          </div>

          <div className="space-y-3">
            {candidates.map((c) => (
              <div
                key={c.symbol}
                className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-xl flex justify-between items-center hover:border-amber-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-amber-200">{c.symbol}</span>
                    <span className="text-xs text-slate-400">({c.name})</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Liquidity: ${(c.liquidityUsd / 1000000).toFixed(1)}M | 5m Vol: ${(c.volume5mUsd / 1000).toFixed(0)}k
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-black text-white">${c.priceUsd}</div>
                  <div className={`text-xs font-bold ${c.change5mPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c.change5mPct >= 0 ? '+' : ''}
                    {c.change5mPct}%
                  </div>
                  <div className="text-[10px] text-amber-400 font-extrabold mt-0.5">
                    Safety Score: {c.safetyScore}/100
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bot Controls & Risk Rules */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
              🛡️ Micro-Capital Risk Parameters
            </h3>
            <p className="text-xs text-slate-400">Tailored for small balance accounts ($10 – $50)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Hard Stop-Loss</span>
              <span className="text-lg font-black text-red-400">-8.00%</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Take Profit Target</span>
              <span className="text-lg font-black text-emerald-400">+15.00%</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Trade Slice Size</span>
              <span className="text-lg font-black text-amber-300">$10.00 USDC</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Slippage Limit</span>
              <span className="text-lg font-black text-cyan-300">&lt; 0.50%</span>
            </div>
          </div>

          <div className="bg-amber-950/30 border border-amber-500/30 p-3.5 rounded-xl text-xs text-amber-200/90 leading-relaxed mt-2">
            💡 <strong>Supabase Integration Mode:</strong> Trade events sync with Supabase PostgreSQL tables and execute automatically via Deno Edge Functions and `pg_cron` jobs.
          </div>
        </div>
      </div>

      {/* Live Trade Positions Table */}
      <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-lg font-black text-amber-300">📊 Live Bot Position Log</h3>
          <span className="text-xs text-slate-400 font-bold">Autonomously Managed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-extrabold">
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Pair</th>
                <th className="py-2 px-3">Capital Spent</th>
                <th className="py-2 px-3">Execution Price</th>
                <th className="py-2 px-3">PnL</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {tradeLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/60 font-semibold text-white">
                  <td className="py-3 px-3 font-black text-amber-300">{log.type}</td>
                  <td className="py-3 px-3">{log.pair}</td>
                  <td className="py-3 px-3 text-slate-300">{log.amount}</td>
                  <td className="py-3 px-3">{log.price}</td>
                  <td className="py-3 px-3 font-bold text-emerald-400">{log.pnl}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                        log.status === 'OPEN'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
