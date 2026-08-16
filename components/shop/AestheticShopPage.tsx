import React, { useMemo, useState } from 'react';
import { ADULT_GAMES, UNDER18_GAMES } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import { GameAesthetic } from '../../types';
import GlassButton from '../ui/GlassButton';

type ShopSection = 'coins' | 'supporter' | 'support' | 'tickets';

interface CheckoutOffer {
  id: string;
  name: string;
  price: string;
  checkoutUrl?: string;
}

const coinPackages: Array<CheckoutOffer & { coins: number; note: string }> = [
  { id: 'fc_starter', name: 'Starter Stack', coins: 1_000, price: '$0.99', note: 'A quick refill for casual play.', checkoutUrl: import.meta.env.VITE_CHECKOUT_FC_STARTER_URL },
  { id: 'fc_player', name: 'Player Pack', coins: 5_500, price: '$4.99', note: 'Our everyday coin package.', checkoutUrl: import.meta.env.VITE_CHECKOUT_FC_PLAYER_URL },
  { id: 'fc_arcade', name: 'Arcade Pack', coins: 12_000, price: '$9.99', note: 'More play across the whole arcade.', checkoutUrl: import.meta.env.VITE_CHECKOUT_FC_ARCADE_URL },
  { id: 'fc_vault', name: 'Coin Vault', coins: 30_000, price: '$19.99', note: 'The largest Fun Coin package.', checkoutUrl: import.meta.env.VITE_CHECKOUT_FC_VAULT_URL },
];

const supporterPlan: CheckoutOffer & { coins: number; benefits: string[] } = {
  id: 'arcade_supporter',
  name: 'Arcade Supporter',
  price: '$4.99 / month',
  coins: 6_000,
  benefits: ['6,000 Fun Coins each month', 'Supporter profile badge', 'Exclusive cosmetic drops', 'Cancel anytime'],
  checkoutUrl: import.meta.env.VITE_CHECKOUT_SUPPORTER_URL,
};

const supportOptions: CheckoutOffer[] = [
  { id: 'support_2', name: 'High Five', price: '$2', checkoutUrl: import.meta.env.VITE_CHECKOUT_SUPPORT_2_URL },
  { id: 'support_5', name: 'Buy Us a Coffee', price: '$5', checkoutUrl: import.meta.env.VITE_CHECKOUT_SUPPORT_5_URL },
  { id: 'support_10', name: 'Power Up the Project', price: '$10', checkoutUrl: import.meta.env.VITE_CHECKOUT_SUPPORT_10_URL },
  { id: 'support_25', name: 'Arcade Champion', price: '$25', checkoutUrl: import.meta.env.VITE_CHECKOUT_SUPPORT_25_URL },
];

const shopSections: Array<{ id: ShopSection; label: string; icon: string }> = [
  { id: 'coins', label: 'Coin Packages', icon: '🪙' },
  { id: 'supporter', label: 'Monthly Supporter', icon: '⭐' },
  { id: 'support', label: 'Support Developers', icon: '💛' },
  { id: 'tickets', label: 'Ticket Rewards', icon: '🎟' },
];

const rewardLabel = (aesthetic: GameAesthetic) => {
  if (aesthetic.rewardType === 'coins') return `+${aesthetic.rewardAmount} coins`;
  if (aesthetic.rewardType === 'experience') return `+${aesthetic.rewardAmount} XP`;
  return `+${aesthetic.rewardAmount} power-up${aesthetic.rewardAmount === 1 ? '' : 's'}`;
};

const AestheticShopPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const {
    funCoins, tickets, progression, aesthetics, ownedAestheticIds, equippedAesthetics,
    purchaseAesthetic, equipAesthetic, isProcessing,
  } = useCoinSystem();
  const games = useMemo(() => [...UNDER18_GAMES, ...ADULT_GAMES], []);
  const [section, setSection] = useState<ShopSection>('coins');
  const [selectedGameId, setSelectedGameId] = useState(games[0].id);
  const [message, setMessage] = useState('');
  const visibleAesthetics = aesthetics.filter((item) => item.gameId === selectedGameId);

  const beginCheckout = (offer: CheckoutOffer) => {
    if (!user || user.isGuest) {
      setMessage('Sign in with a full account before making a purchase.');
      return;
    }
    if (!offer.checkoutUrl) {
      setMessage(`${offer.name} checkout is not connected yet. You have not been charged.`);
      return;
    }
    window.location.assign(offer.checkoutUrl);
  };

  const handlePurchase = async (aesthetic: GameAesthetic) => {
    if (tickets < aesthetic.ticketCost) {
      setMessage(`You need ${aesthetic.ticketCost - tickets} more tickets to unlock ${aesthetic.name}.`);
      return;
    }
    if (progression.experience < aesthetic.requiredExperience) {
      setMessage(`Earn ${aesthetic.requiredExperience - progression.experience} more XP to unlock ${aesthetic.name}.`);
      return;
    }
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

  const purchaseButton = (offer: CheckoutOffer, label = 'Continue to Secure Checkout') => (
    <button
      type="button"
      onClick={() => beginCheckout(offer)}
      className="mt-5 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-3 font-black text-gray-950 shadow-lg shadow-amber-500/10 transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-yellow-200"
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GlassButton onClick={onBack} className="self-start px-4 text-sm">← Back to Games</GlassButton>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-yellow-300/25 bg-yellow-950/60 px-3 py-2 text-sm font-black text-yellow-200">🪙 {Math.floor(funCoins).toLocaleString()} FC</div>
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-950/60 px-3 py-2 text-sm font-black text-cyan-200">🎟 {tickets.toLocaleString()} tickets</div>
          <div className="rounded-xl border border-purple-300/25 bg-purple-950/60 px-3 py-2 text-sm font-black text-purple-200">✨ {progression.experience.toLocaleString()} XP</div>
        </div>
      </div>

      <header className="overflow-hidden rounded-3xl border border-yellow-400/25 bg-gradient-to-br from-amber-950/90 via-gray-950 to-cyan-950/80 p-6 text-center shadow-2xl md:p-9">
        <p className="text-xs font-black uppercase tracking-[.3em] text-cyan-300">Arcade Hub Shop</p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Play More. Personalize More.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-300">Buy optional Fun Coins, unlock earned ticket rewards, or support continued development.</p>
      </header>

      <aside className="my-5 rounded-2xl border-2 border-amber-300/50 bg-amber-950/45 p-4 text-center text-xs font-bold leading-relaxed text-amber-100 sm:text-sm" aria-label="Virtual currency notice">
        <p className="text-sm font-black uppercase tracking-wide text-yellow-300">No cash value · No withdrawals · No cash prizes</p>
        <p className="mx-auto mt-2 max-w-4xl">All Arcade Hub coins and credits are virtual entertainment items. They cannot be transferred, redeemed, withdrawn, or exchanged for real money. Purchases are optional and used only for virtual gameplay, cosmetics, subscriptions, and supporting development.</p>
      </aside>

      <nav className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 lg:grid-cols-4" aria-label="Shop sections">
        {shopSections.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => { setSection(item.id); setMessage(''); }}
            className={`rounded-xl px-3 py-3 text-xs font-black transition sm:text-sm ${section === item.id ? 'bg-yellow-400 text-gray-950 shadow-lg shadow-yellow-400/20' : 'bg-white/5 text-gray-200 hover:bg-white/10'}`}
          >
            <span aria-hidden="true">{item.icon}</span> {item.label}
          </button>
        ))}
      </nav>

      {section === 'coins' && (
        <section aria-labelledby="coin-packages-title">
          <div className="mb-5 text-center">
            <h3 id="coin-packages-title" className="text-2xl font-black text-white">Fun Coin Packages</h3>
            <p className="mt-1 text-sm text-gray-400">Fun Coins are for virtual arcade play only and never have cash value.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {coinPackages.map((coinPackage, index) => (
              <article key={coinPackage.id} className={`relative flex min-h-[285px] flex-col rounded-2xl border p-5 shadow-xl ${index === 2 ? 'border-yellow-300/70 bg-gradient-to-b from-amber-900/55 to-gray-950' : 'border-white/15 bg-gray-950/85'}`}>
                {index === 2 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-950">Popular</span>}
                <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{coinPackage.name}</p>
                <div className="my-5 text-center">
                  <p className="text-4xl font-black text-yellow-300">{coinPackage.coins.toLocaleString()}</p>
                  <p className="text-sm font-bold text-yellow-100/70">Fun Coins</p>
                </div>
                <p className="flex-1 text-center text-xs leading-relaxed text-gray-400">{coinPackage.note}</p>
                <p className="mt-4 text-center text-2xl font-black text-white">{coinPackage.price}</p>
                {purchaseButton(coinPackage, `Buy ${coinPackage.coins.toLocaleString()} FC`)}
              </article>
            ))}
          </div>
        </section>
      )}

      {section === 'supporter' && (
        <section className="mx-auto max-w-3xl" aria-labelledby="supporter-title">
          <article className="overflow-hidden rounded-3xl border border-fuchsia-300/45 bg-gradient-to-br from-fuchsia-950/80 via-gray-950 to-cyan-950/75 shadow-2xl">
            <div className="border-b border-white/10 p-6 text-center md:p-9">
              <span className="text-5xl" aria-hidden="true">⭐</span>
              <p className="mt-3 text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">Monthly membership</p>
              <h3 id="supporter-title" className="mt-2 text-3xl font-black text-white">{supporterPlan.name}</h3>
              <p className="mt-2 text-3xl font-black text-yellow-300">{supporterPlan.price}</p>
            </div>
            <div className="p-6 md:p-9">
              <ul className="grid gap-3 sm:grid-cols-2">
                {supporterPlan.benefits.map((benefit) => <li key={benefit} className="rounded-xl border border-white/10 bg-white/5 p-4 font-bold text-gray-200"><span className="mr-2 text-emerald-300">✓</span>{benefit}</li>)}
              </ul>
              {purchaseButton(supporterPlan, 'Become an Arcade Supporter')}
              <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">Renews monthly until canceled. Benefits are virtual, have no cash value, and do not improve the odds of winning any game.</p>
            </div>
          </article>
        </section>
      )}

      {section === 'support' && (
        <section aria-labelledby="support-title">
          <div className="mx-auto mb-6 max-w-3xl text-center">
            <span className="text-5xl" aria-hidden="true">💛</span>
            <h3 id="support-title" className="mt-2 text-2xl font-black text-white">Support the Developers</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">Help fund hosting, artwork, testing, and new games. These are optional support purchases—not charitable or tax-deductible donations—and they do not award coins or affect gameplay.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {supportOptions.map((option) => (
              <article key={option.id} className="flex flex-col rounded-2xl border border-yellow-300/20 bg-gradient-to-b from-yellow-950/40 to-gray-950 p-5 text-center shadow-xl">
                <p className="text-sm font-black text-yellow-200">{option.name}</p>
                <p className="my-5 flex-1 text-3xl font-black text-white">{option.price}</p>
                {purchaseButton(option, `Support with ${option.price}`)}
              </article>
            ))}
          </div>
        </section>
      )}

      {section === 'tickets' && (
        <section aria-labelledby="ticket-rewards-title">
          <div className="mb-5 text-center">
            <h3 id="ticket-rewards-title" className="text-2xl font-black text-white">Ticket Rewards</h3>
            <p className="mt-1 text-sm text-gray-400">Earn tickets and XP by playing, then unlock visual styles. No real-money purchase is required.</p>
          </div>
          <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2" aria-label="Choose a game">
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
                    <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white">Ticket reward</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h4 className="text-lg font-black text-white">{aesthetic.name}</h4>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-400">{aesthetic.description}</p>
                    <div className="mt-4 space-y-2 text-xs font-bold">
                      <div className={`flex justify-between rounded-lg p-2 ${hasTickets ? 'bg-cyan-400/10 text-cyan-200' : 'bg-red-500/10 text-red-300'}`}><span>Price</span><span>🎟 {aesthetic.ticketCost}</span></div>
                      <div className={`flex justify-between rounded-lg p-2 ${hasExperience ? 'bg-purple-400/10 text-purple-200' : 'bg-red-500/10 text-red-300'}`}><span>Requires</span><span>{aesthetic.requiredExperience.toLocaleString()} XP</span></div>
                      <div className="flex justify-between rounded-lg bg-emerald-400/10 p-2 text-emerald-200"><span>Small bonus</span><span>{rewardLabel(aesthetic)}</span></div>
                    </div>
                    {owned ? (
                      <button type="button" disabled={equipped || isProcessing} onClick={() => handleEquip(aesthetic)} className="mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 font-black text-white disabled:opacity-50">{equipped ? '✓ Equipped' : 'Equip Style'}</button>
                    ) : (
                      <button type="button" disabled={isProcessing || user?.isGuest} onClick={() => handlePurchase(aesthetic)} className="mt-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 font-black text-gray-950 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40">{!hasExperience ? 'Earn More XP' : !hasTickets ? 'Need Tickets' : 'Buy with Tickets'}</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {visibleAesthetics.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/20 py-16 text-center text-gray-400">Ticket rewards are unavailable right now. Please try again after signing in.</p>}
        </section>
      )}

      {message && <p role="status" className="mt-6 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4 text-center font-bold text-fuchsia-100">{message}</p>}

      <p className="mx-auto mt-8 max-w-4xl border-t border-white/10 pt-5 text-center text-[11px] leading-relaxed text-gray-500">Secure checkout opens with the configured payment provider. Coins and subscription benefits must be fulfilled only after payment is verified by the server. Arcade Hub does not offer refunds as cash-out or allow virtual balances to be redeemed for money.</p>
    </div>
  );
};

export default AestheticShopPage;
