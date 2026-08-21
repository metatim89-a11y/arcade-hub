import React, { useMemo, useState } from 'react';
import { ADULT_GAMES, UNDER18_GAMES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import { GameAesthetic } from '../../types';
import { getSupabase } from '../../lib/supabase';
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
  gc: number;
  rc: number;
}

const MICRO_PACKAGES: MicroPackage[] = [
  { id: 'pkg1', name: 'Micro Tip', desc: '+1,000 GC / +10 RC', costTk: 250, price: '$0.25', gc: 1000, rc: 10 },
  { id: 'pkg2', name: 'Snack Pack', desc: '+2,500 GC / +25 RC', costTk: 500, price: '$0.50', gc: 2500, rc: 25 },
  { id: 'pkg3', name: 'Starter Stack', desc: '+5,000 GC / +50 RC', costTk: 1000, price: '$0.99', gc: 5000, rc: 50 },
  { id: 'pkg4', name: 'Arcade Boost', desc: '+8,500 GC / +85 RC', costTk: 1500, price: '$1.49', gc: 8500, rc: 85 },
  { id: 'pkg5', name: 'Fan Supporter', desc: '+15,000 GC / +150 RC', costTk: 2500, price: '$2.49', gc: 15000, rc: 150 },
];

const AestheticShopPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const {
    tickets, progression, aesthetics, ownedAestheticIds, equippedAesthetics,
    purchaseAesthetic, equipAesthetic, isProcessing, syncBalance,
  } = useCoinSystem();
  const games = useMemo(() => [...UNDER18_GAMES, ...ADULT_GAMES], []);
  const [selectedGameId, setSelectedGameId] = useState(games[0].id);
  const [message, setMessage] = useState('');
  const [redeemingPackageId, setRedeemingPackageId] = useState<string | null>(null);

  const visibleAesthetics = aesthetics.filter((item) => item.gameId === selectedGameId);

  const handlePurchase = async (aesthetic: GameAesthetic) => {
    if (tickets < aesthetic.ticketCost || progression.experience < aesthetic.requiredExperience) return;
    if (!window.confirm(`Buy ${aesthetic.name} for ${aesthetic.ticketCost} tickets?`)) return;
    setMessage(`Buying ${aesthetic.name}…`);
    const reward = await purchaseAesthetic(aesthetic.id);
    setMessage(reward ? `${aesthetic.name} unlocked. Bonus: ${rewardLabel(aesthetic)}.` : 'The purchase was not completed. No tickets were removed.');
  };

  const handleEquip = async (aesthetic: GameAesthetic) => {
    setMessage(`Equipping ${aesthetic.name}…`);
    const equipped = await equipAesthetic(aesthetic.id);
    setMessage(equipped ? `${aesthetic.name} is now equipped.` : 'The aesthetic could not be equipped.');
  };

  const redeemTicketPackage = async (pkg: MicroPackage) => {
    if (!user || user.isGuest || tickets < pkg.costTk || redeemingPackageId) return;
    setRedeemingPackageId(pkg.id);
    setMessage(`Redeeming ${pkg.name}…`);
    try {
      const { error } = await getSupabase().rpc('redeem_ticket_package', { p_user_id: user.id, p_package_id: pkg.id });
      if (error) throw error;
      await syncBalance();
      setMessage(`${pkg.name} redeemed. ${pkg.costTk.toLocaleString()} tickets were used and ${pkg.gc.toLocaleString()} GC / ${pkg.rc} RC were added.`);
    } catch (error: any) {
      setMessage(error?.message || 'Ticket redemption failed. No rewards were added.');
    } finally {
      setRedeemingPackageId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <GlassButton onClick={onBack} className="self-start px-4 text-sm">← Back to Games</GlassButton>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-950/60 px-4 py-2 font-black text-cyan-200">🎟 {tickets.toLocaleString()} tickets</div>
          <div className="rounded-xl border border-purple-300/25 bg-purple-950/60 px-4 py-2 font-black text-purple-200">✨ {progression.experience.toLocaleString()} XP</div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
        <p className="text-sm font-black text-emerald-100">You never need to spend money to play Arcade Hub.</p>
        <p className="mt-1 text-xs leading-5 text-emerald-200/80">GC is provided through free arcade systems. Tickets are earned inside the arcade. Optional future purchases are intended to support development, hosting, servers, art, sound and continued improvements.</p>
      </div>

      <div className="mb-8 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-center text-xs font-black uppercase tracking-wide text-red-100">No cash withdrawals are currently offered. GC, RC, tickets, XP and cosmetics are virtual entertainment items.</div>

      <header className="rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-950/80 via-gray-900 to-cyan-950/70 p-7 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.3em] text-fuchsia-300">Ticket-only collection</p>
        <h2 className="mt-2 text-4xl font-black text-white">Arcade Aesthetics</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-300">Use earned tickets to unlock visual styles after reaching the required XP. Cosmetics change presentation, not cash value.</p>
      </header>

      <nav className="my-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2" aria-label="Choose a game">
        {games.map((game) => <button key={game.id} type="button" onClick={() => setSelectedGameId(game.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${selectedGameId === game.id ? 'bg-yellow-400 text-gray-950' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>{game.label}</button>)}
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
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-black text-white">{aesthetic.name}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-400">{aesthetic.description}</p>
                <div className="mt-4 space-y-2 text-xs font-bold">
                  <div className={`flex justify-between rounded-lg p-2 ${hasTickets ? 'bg-cyan-400/10 text-cyan-200' : 'bg-red-500/10 text-red-300'}`}><span>Price</span><span>🎟 {aesthetic.ticketCost}</span></div>
                  <div className={`flex justify-between rounded-lg p-2 ${hasExperience ? 'bg-purple-400/10 text-purple-200' : 'bg-red-500/10 text-red-300'}`}><span>Requires</span><span>{aesthetic.requiredExperience.toLocaleString()} XP</span></div>
                  <div className="flex justify-between rounded-lg bg-emerald-400/10 p-2 text-emerald-200"><span>Bonus</span><span>{rewardLabel(aesthetic)}</span></div>
                </div>
                {owned ? <button type="button" disabled={equipped || isProcessing} onClick={() => void handleEquip(aesthetic)} className="mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 font-black text-white disabled:opacity-50">{equipped ? '✓ Equipped' : 'Equip Style'}</button> : <button type="button" disabled={!hasTickets || !hasExperience || isProcessing || user?.isGuest} onClick={() => void handlePurchase(aesthetic)} className="mt-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 font-black text-gray-950 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40">{!hasExperience ? 'Earn More XP' : !hasTickets ? 'Need Tickets' : 'Buy with Tickets'}</button>}
              </div>
            </article>
          );
        })}
      </div>
      {visibleAesthetics.length === 0 && <p className="py-16 text-center text-gray-400">No cosmetics are available for this game yet.</p>}

      <header className="mb-6 mt-12 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-950/60 via-gray-900 to-blue-950/60 p-7 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.3em] text-cyan-300">Earned-ticket exchange</p>
        <h2 className="mt-2 text-4xl font-black text-white">Ticket Reward Packs</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-300">Exchange tickets earned in the arcade for virtual GC and RC. The server deducts the ticket cost and adds the reward together in one protected transaction.</p>
      </header>

      <div className="mb-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {MICRO_PACKAGES.map((pkg) => <article key={pkg.id} className="flex flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-gray-900/90 shadow-xl"><div className="border-b border-cyan-500/20 bg-black/40 p-4 text-center"><h3 className="text-lg font-black text-cyan-100">{pkg.name}</h3><div className="mt-1 text-xs font-bold text-cyan-400">{pkg.desc}</div></div><div className="flex flex-1 flex-col p-4"><p className="text-xs leading-5 text-slate-400">Redeem earned tickets for this virtual reward pack.</p><button type="button" disabled={tickets < pkg.costTk || Boolean(redeemingPackageId) || user?.isGuest} onClick={() => void redeemTicketPackage(pkg)} className="mt-4 rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-3 font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40">{redeemingPackageId === pkg.id ? 'REDEEMING…' : `🎟 ${pkg.costTk.toLocaleString()} TICKETS`}</button></div></article>)}
      </div>

      <section className="rounded-3xl border border-amber-400/25 bg-amber-500/5 p-6 text-center">
        <p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">Optional support purchases</p>
        <h2 className="mt-2 text-2xl font-black text-white">Payment checkout is not active yet</h2>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-slate-300">When real payment support is enabled, checkout must be verified by the server before any virtual balance is awarded. Any optional purchase will be described as support for Arcade Hub development and operating costs. Until that verified flow exists, this shop will not simulate or fake a successful payment.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">{MICRO_PACKAGES.map((pkg) => <span key={pkg.id} className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-slate-400">{pkg.name} · planned {pkg.price}</span>)}</div>
      </section>

      {message && <p role="status" className="mt-6 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4 text-center font-bold text-fuchsia-100">{message}</p>}
    </div>
  );
};

export default AestheticShopPage;
