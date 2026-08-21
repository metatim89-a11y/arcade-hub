import React, { useMemo, useState } from 'react';
import { ADULT_GAMES, UNDER18_GAMES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import { GameAesthetic } from '../../types';
import GlassButton from '../ui/GlassButton';

const rewardLabel = (aesthetic: GameAesthetic) => {
  if (aesthetic.rewardType === 'coins') return `+${aesthetic.rewardAmount} coins`;
  if (aesthetic.rewardType === 'experience') return `+${aesthetic.rewardAmount} XP`;
  return `+${aesthetic.rewardAmount} power-up${aesthetic.rewardAmount === 1 ? '' : 's'}`;
};

interface MicroPackage {
  id: string;
  name: string;
  desc: string;
  costTk: number;
  price: string;
  cryptoVal: string;
  gc: number;
  rc: number;
}

const MICRO_PACKAGES: MicroPackage[] = [
  { id: 'pkg1', name: 'Micro Tip', desc: '+1,000 GC / +10 RC', costTk: 250, price: '$0.25', cryptoVal: '~0.25 USDT / SOL', gc: 1000, rc: 10 },
  { id: 'pkg2', name: 'Snack Pack', desc: '+2,500 GC / +25 RC', costTk: 500, price: '$0.50', cryptoVal: '~0.50 USDT / SOL', gc: 2500, rc: 25 },
  { id: 'pkg3', name: 'Starter Stack', desc: '+5,000 GC / +50 RC', costTk: 1000, price: '$0.99', cryptoVal: '~0.99 USDT / SOL', gc: 5000, rc: 50 },
  { id: 'pkg4', name: 'Arcade Boost', desc: '+8,500 GC / +85 RC', costTk: 1500, price: '$1.49', cryptoVal: '~1.49 USDT / SOL', gc: 8500, rc: 85 },
  { id: 'pkg5', name: 'Fan Supporter', desc: '+15,000 GC / +150 RC', costTk: 2500, price: '$2.49', cryptoVal: '~2.49 USDT / SOL', gc: 15000, rc: 150 },
];

const AestheticShopPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const {
    tickets, progression, aesthetics, ownedAestheticIds, equippedAesthetics,
    purchaseAesthetic, equipAesthetic, isProcessing, addCoins
  } = useCoinSystem();
  const games = useMemo(() => [...UNDER18_GAMES, ...ADULT_GAMES], []);
  const [selectedGameId, setSelectedGameId] = useState(games[0].id);
  const [message, setMessage] = useState('');
  const [activeCryptoPkg, setActiveCryptoPkg] = useState<MicroPackage | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const visibleAesthetics = aesthetics.filter((item) => item.gameId === selectedGameId);

  const handlePurchase = async (aesthetic: GameAesthetic) => {
    if (tickets < aesthetic.ticketCost || progression.experience < aesthetic.requiredExperience) return;
    if (!window.confirm(`Buy ${aesthetic.name} for ${aesthetic.ticketCost} tickets? Ticket purchases cannot be reversed.`)) return;
    setMessage(`Buying ${aesthetic.name}…`);
    const reward = await purchaseAesthetic(aesthetic.id);
    setMessage(reward
      ? `${aesthetic.name} unlocked. Your bonus: ${rewardLabel(aesthetic)}.`
      : 'The purchase was not completed. No tickets were removed.');
  };

  const handleEquip = async (aesthetic: GameAesthetic) => {
    setMessage(`Equipping ${aesthetic.name}…`);
    const equipped = await equipAesthetic(aesthetic.id);
    setMessage(equipped ? `${aesthetic.name} is now equipped.` : 'The aesthetic could not be equipped.');
  };

  const handleCopy = (address: string) => {
    void navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <GlassButton onClick={onBack} className="self-start px-4 text-sm">← Back to Games</GlassButton>
        <div className="flex gap-3">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-950/60 px-4 py-2 font-black text-cyan-200">🎟 {tickets.toLocaleString()} tickets</div>
          <div className="rounded-xl border border-purple-300/25 bg-purple-950/60 px-4 py-2 font-black text-purple-200">✨ {progression.experience.toLocaleString()} XP</div>
        </div>
      </div>

      {/* Responsible Gaming Notice */}
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
        <p className="text-xs font-bold text-amber-200 uppercase tracking-wider">
          ⚠️ Entertainment Notice: All coins (GC/RC) and shop items are for fun, cosmetics, & leaderboards only. Coins cannot be withdrawn or converted to real money.
        </p>
      </div>

      <header className="rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-950/80 via-gray-900 to-cyan-950/70 p-7 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.3em] text-fuchsia-300">Ticket-only collection</p>
        <h2 className="mt-2 text-4xl font-black text-white">Arcade Aesthetics</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-300">Unlock visual styles with tickets after earning the required XP. Each purchase includes a small one-time bonus; sacrificing tickets remains much stronger for leveling.</p>
      </header>

      <nav className="my-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2" aria-label="Choose a game">
        {games.map((game) => (
          <button key={game.id} type="button" onClick={() => setSelectedGameId(game.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${selectedGameId === game.id ? 'bg-yellow-400 text-gray-950' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>{game.label}</button>
        ))}
      </nav>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {visibleAesthetics.map((aesthetic) => {
          const owned = ownedAestheticIds.includes(aesthetic.id);
          const equipped = equippedAesthetics[aesthetic.gameId] === aesthetic.id;
          const hasTickets = tickets >= aesthetic.ticketCost;
          const hasExperience = progression.experience >= aesthetic.requiredExperience;
          return (
            <article key={aesthetic.id} className="flex min-h-[390px] flex-col overflow-hidden rounded-2xl border bg-gray-900/90 shadow-xl" style={{ borderColor: `${aesthetic.accentColor}66` }}>
              <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${aesthetic.gradientFrom}, ${aesthetic.gradientTo})` }}>
                <div className="absolute inset-0 opacity-35" style={{ backgroundImage: `repeating-linear-gradient(115deg, transparent 0 12px, ${aesthetic.accentColor} 13px 14px)` }} />
                <div className="absolute inset-4 rounded-xl border-2" style={{ borderColor: aesthetic.accentColor, boxShadow: `0 0 22px ${aesthetic.accentColor}` }} />
                <span className="absolute bottom-3 left-4 text-xs font-black uppercase tracking-[.2em]" style={{ color: aesthetic.accentColor }}>{aesthetic.visualKey}</span>
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white">Value ${(aesthetic.valueCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-black text-white">{aesthetic.name}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-400">{aesthetic.description}</p>
                <div className="mt-4 space-y-2 text-xs font-bold">
                  <div className={`flex justify-between rounded-lg p-2 ${hasTickets ? 'bg-cyan-400/10 text-cyan-200' : 'bg-red-500/10 text-red-300'}`}><span>Price</span><span>🎟 {aesthetic.ticketCost}</span></div>
                  <div className={`flex justify-between rounded-lg p-2 ${hasExperience ? 'bg-purple-400/10 text-purple-200' : 'bg-red-500/10 text-red-300'}`}><span>Requires</span><span>{aesthetic.requiredExperience.toLocaleString()} XP</span></div>
                  <div className="flex justify-between rounded-lg bg-emerald-400/10 p-2 text-emerald-200"><span>Small bonus</span><span>{rewardLabel(aesthetic)}</span></div>
                </div>
                {owned ? (
                  <button type="button" disabled={equipped || isProcessing} onClick={() => handleEquip(aesthetic)} className="mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 font-black text-white disabled:opacity-50">{equipped ? '✓ Equipped' : 'Equip Style'}</button>
                ) : (
                  <button type="button" disabled={!hasTickets || !hasExperience || isProcessing || user?.isGuest} onClick={() => handlePurchase(aesthetic)} className="mt-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 font-black text-gray-950 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40">{!hasExperience ? 'Earn More XP' : !hasTickets ? 'Need Tickets' : 'Buy with Tickets'}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {visibleAesthetics.length === 0 && <p className="py-16 text-center text-gray-400">Loading this game’s aesthetics…</p>}

      {/* Micro Coin Packages Section */}
      <header className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-950/80 via-gray-900 to-yellow-950/70 p-7 text-center shadow-2xl mt-12 mb-6">
        <p className="text-xs font-black uppercase tracking-[.3em] text-amber-300">Support the Arcade</p>
        <h2 className="mt-2 text-4xl font-black text-white">Micro Coin Tip Packs</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-300">Small change tips for extra game coins & support! Keep it light & fun — no giant packages.</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-5 mb-16">
        {MICRO_PACKAGES.map(pkg => (
           <article key={pkg.id} className="flex flex-col rounded-2xl border border-amber-500/30 bg-gray-900/90 shadow-xl overflow-hidden relative">
              <div className="p-4 text-center bg-black/40 border-b border-amber-500/20 relative">
                  <h3 className="text-lg font-black text-amber-200">{pkg.name}</h3>
                  <div className="text-xs font-bold text-amber-500/80 mt-0.5">{pkg.desc}</div>
              </div>
              <div className="p-4 flex flex-col gap-2">
                  <button 
                    type="button" 
                    onClick={() => setActiveCryptoPkg(pkg)}
                    className="rounded-xl border border-purple-500/50 bg-purple-500/10 px-3 py-2.5 font-black text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all w-full text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>⚡ Pay with Crypto</span>
                    <span className="text-[10px] text-purple-400">({pkg.price})</span>
                  </button>

                  <div className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">- OR -</div>

                  <button 
                    type="button" 
                    disabled={tickets < pkg.costTk} 
                    onClick={() => {
                      addCoins(pkg.gc, 'fun');
                      addCoins(pkg.rc, 'real');
                      setMessage(`Redeemed ${pkg.name}! Added ${pkg.gc} GC and ${pkg.rc} RC.`);
                    }} 
                    className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-2.5 font-black text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 disabled:grayscale active:scale-95 transition-all w-full text-xs"
                  >
                      🎟 {pkg.costTk.toLocaleString()} Tickets
                  </button>
              </div>
           </article>
        ))}
      </div>

      {/* Crypto Payment Modal */}
      {activeCryptoPkg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-purple-500/30 bg-slate-900 p-6 shadow-2xl relative text-slate-100 space-y-5">
            <button 
              type="button" 
              onClick={() => setActiveCryptoPkg(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-black text-lg"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase">INSTANT CRYPTO PAY</span>
              <h3 className="text-2xl font-black text-white">{activeCryptoPkg.name} ({activeCryptoPkg.price})</h3>
              <p className="text-xs text-slate-400">{activeCryptoPkg.desc}</p>
            </div>

            {/* Wallet Connect Button */}
            <button 
              type="button"
              onClick={() => {
                alert("Web3 Wallet Request Sent! If Web3 wallet (e.g. Phantom / MetaMask) is available, popup will prompt approval.");
              }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-xl text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>🦊 Connect Web3 Wallet</span>
            </button>

            <div className="text-center text-xs text-slate-500 font-bold uppercase tracking-widest">- OR DIRECT DEPOSIT -</div>

            {/* Deposit Address Box */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>Accepted Networks:</span>
                <span className="text-purple-300">SOL / USDT / BTC / ETH</span>
              </div>
              <div className="p-3 bg-black/50 rounded-lg border border-purple-500/20 font-mono text-xs text-purple-200 break-all flex items-center justify-between gap-2">
                <span>0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7</span>
                <button 
                  type="button" 
                  onClick={() => handleCopy('0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7')}
                  className="px-2.5 py-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 rounded text-[10px] font-sans font-bold whitespace-nowrap"
                >
                  {copiedAddress ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <button 
              type="button" 
              onClick={() => {
                addCoins(activeCryptoPkg.gc, 'fun');
                addCoins(activeCryptoPkg.rc, 'real');
                setMessage(`Simulated Crypto Tx confirmed! Added ${activeCryptoPkg.gc} GC and ${activeCryptoPkg.rc} RC.`);
                setActiveCryptoPkg(null);
              }} 
              className="w-full py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-sm shadow-lg hover:bg-emerald-400 active:scale-95 transition-all"
            >
              Confirm Simulated Deposit ({activeCryptoPkg.cryptoVal})
            </button>
          </div>
        </div>
      )}

      {message && <p role="status" className="mt-6 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4 text-center font-bold text-fuchsia-100">{message}</p>}
    </div>
  );
};

export default AestheticShopPage;
