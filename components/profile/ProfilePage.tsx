
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCoinSystem } from '../../context/CoinContext';
import GlassButton from '../ui/GlassButton';
import { BADGE_GAMES, earnedBadges, GOLD_SPEND_COINS, PROFILE_FRAMES, profileFrameForLevel, SILVER_SPEND_COINS } from '../../lib/profileRewards';

const ProfilePage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, updateProfile, changePassword } = useAuth();
  const {
    funCoins, realCoins, tickets, progression, transactions, gameStats, isProcessing,
    sacrificeForExperience, claimLevelFaucet, claimLevelPowerups, syncBalance,
  } = useCoinSystem();
  
  // Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [newPassword, setNewPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'progression' | 'history' | 'dev'>('overview');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'gaming'>('all');
  const [sacrificeCoins, setSacrificeCoins] = useState(0);
  const [sacrificeTickets, setSacrificeTickets] = useState(0);
  const [progressionMessage, setProgressionMessage] = useState('');

  // Dev/Git State
  const [currentBranch, setCurrentBranch] = useState('main');
  const [branches, setBranches] = useState(['main', 'dev', 'staging', 'feature/ui-update']);
  const [newBranchName, setNewBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // 'branch', 'commit', 'pull', 'create_repo'

  useEffect(() => { void syncBalance(); }, [syncBalance]);

  if (!user) return null;

  const profileFrame = profileFrameForLevel(progression.level);
  const nextFrame = [...PROFILE_FRAMES].reverse().find((frame) => frame.minimumLevel > progression.level);
  const badges = earnedBadges(gameStats);
  const statFor = (gameId: string) => gameStats.find((stat) => stat.gameId === gameId);
  const gamesAt25Plays = BADGE_GAMES.filter(([gameId]) => (statFor(gameId)?.playCount ?? 0) >= 25).length;
  const gamesAt50Usd = BADGE_GAMES.filter(([gameId]) => (statFor(gameId)?.coinsSpent ?? 0) >= SILVER_SPEND_COINS).length;
  const gamesAt100Usd = BADGE_GAMES.filter(([gameId]) => (statFor(gameId)?.coinsSpent ?? 0) >= GOLD_SPEND_COINS).length;

  const handleSave = async () => {
    setAccountMessage('');
    try {
      await updateProfile({ bio, avatar });
      setIsEditing(false);
      setAccountMessage('Profile saved.');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Unable to save profile.');
    }
  };

  const handlePasswordChange = async () => {
    setAccountMessage('');
    if (newPassword.length < 6) {
      setAccountMessage('Password must be at least 6 characters.');
      return;
    }
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setAccountMessage('Password updated securely.');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'Unable to update password.');
    }
  };

  const handleSacrifice = async () => {
    const coins = Math.max(0, Math.floor(sacrificeCoins));
    const ticketAmount = Math.max(0, Math.floor(sacrificeTickets));
    if ((coins < 10 && ticketAmount === 0) || coins > funCoins || ticketAmount > tickets) {
      setProgressionMessage('Choose at least 10 coins or 1 ticket, without exceeding your balance.');
      return;
    }
    const xpPreview = Math.floor(coins / 10) + (ticketAmount * 50);
    if (!window.confirm(`Permanently sacrifice ${coins.toLocaleString()} coins and ${ticketAmount.toLocaleString()} tickets for ${xpPreview.toLocaleString()} XP?`)) return;
    setProgressionMessage('Sacrificing your currency…');
    const reward = await sacrificeForExperience(coins, ticketAmount);
    if (!reward) {
      setProgressionMessage('The sacrifice was not completed. Your balances were not changed.');
      return;
    }
    setSacrificeCoins(0);
    setSacrificeTickets(0);
    setProgressionMessage(reward.levelsGained > 0
      ? `Level up! You reached level ${reward.level} and earned ${reward.levelsGained * 2} bonus power-up${reward.levelsGained * 2 === 1 ? '' : 's'}.`
      : `Sacrifice complete: +${reward.experienceGained.toLocaleString()} XP.`);
  };

  const handleFaucetClaim = async () => {
    setProgressionMessage('Claiming your level faucet…');
    const reward = await claimLevelFaucet();
    setProgressionMessage(reward
      ? `Daily faucet claimed: +${reward.faucetAmount.toLocaleString()} coins.`
      : 'The faucet is still refilling or could not be claimed.');
  };

  const handlePowerupClaim = async () => {
    setProgressionMessage('Claiming your power-up drop…');
    const amount = await claimLevelPowerups();
    setProgressionMessage(amount
      ? `Power-up drop claimed: +${amount} power-up${amount === 1 ? '' : 's'}.`
      : 'The power-up drop is still recharging or could not be claimed.');
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
      if (historyFilter === 'gaming') return true;
      return true;
  });

  // Simulated Git Actions
  const handleCreateBranch = () => {
      if(!newBranchName.trim()) return;
      setLoadingAction('branch');
      setTimeout(() => {
          const name = newBranchName.trim().replace(/\s+/g, '-').toLowerCase();
          setBranches(prev => [...prev, name]);
          setCurrentBranch(name);
          setNewBranchName('');
          setLoadingAction(null);
      }, 800);
  };

  const handleCommitAndPush = () => {
      if(!commitMessage.trim()) return;
      setLoadingAction('commit');
      setTimeout(() => {
          setLoadingAction(null);
          setCommitMessage('');
          alert(`[${currentBranch}] Changes committed and pushed successfully!`);
      }, 1500);
  };

  const handlePull = () => {
      setLoadingAction('pull');
      setTimeout(() => {
          setLoadingAction(null);
          alert(`Fast-forwarded ${currentBranch} from origin/${currentBranch}.`);
      }, 2000);
  };

  const handleCreateRepo = () => {
      setLoadingAction('create_repo');
      setTimeout(() => {
          setLoadingAction(null);
          alert("Repository '5idecoders-arcade' created successfully on GitHub!");
      }, 2000);
  };

  const handleOpenRepo = () => {
      window.open('https://github.com/5idescoder/arcade-hub', '_blank');
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 animate-slide-in">
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <GlassButton onClick={onBack} className="text-sm px-4 self-start md:self-auto">← Back to Games</GlassButton>
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 bg-gray-900/50 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-yellow-400 text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Overview
                </button>
                <button 
                    onClick={() => setActiveTab('progression')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'progression' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Level Up
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-yellow-400 text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    History
                </button>
                <button 
                    onClick={() => setActiveTab('dev')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'dev' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Git Control
                </button>
            </div>
        </div>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
            <div className="grid md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6 flex flex-col items-center text-center backdrop-blur-sm h-fit shadow-xl">
                    <div className="mb-3 h-32 w-32 rounded-full p-1 shadow-2xl" style={{ background: profileFrame.background, boxShadow: `0 0 28px ${profileFrame.glow}` }}>
                        <img src={user.avatar} alt={user.username} className="h-full w-full rounded-full border-4 border-gray-950 bg-gray-800 object-cover" />
                    </div>
                    <span className="mb-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={{ borderColor: profileFrame.color, color: profileFrame.color }}>{profileFrame.name} · Level {progression.level}</span>
                    {nextFrame && <span className="mb-2 text-[10px] text-gray-500">Next frame: {nextFrame.name} at level {nextFrame.minimumLevel}</span>}
                    <h2 className="text-2xl font-bold text-white mb-1">{user.username}</h2>
                    <div className="text-gray-400 text-xs mb-4 flex items-center justify-center gap-2">
                         {user.isVerified ? (
                             <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
                                 ✓ Verified
                             </span>
                         ) : (
                             <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">Unverified</span>
                         )}
                         <span className="text-gray-600">•</span>
                         <span>Joined {new Date(user.joinedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="w-full bg-black/30 rounded-xl p-3 mb-4">
                        {isEditing ? (
                            <div className="flex flex-col gap-2">
                                <div className="text-left">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Profile Picture URL</label>
                                    <input 
                                        type="text" 
                                        value={avatar} 
                                        onChange={(e) => setAvatar(e.target.value)}
                                        className="bg-gray-800 border border-gray-600 rounded p-2 text-xs text-white w-full focus:border-yellow-400 outline-none mb-2"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="text-left">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Bio</label>
                                    <textarea 
                                        value={bio} 
                                        onChange={(e) => setBio(e.target.value)}
                                        className="bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white w-full focus:border-yellow-400 outline-none"
                                        rows={3}
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 rounded font-bold">Save</button>
                                    <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded font-bold">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="group relative">
                                <p className="text-gray-300 text-sm italic">"{bio || "No bio yet."}"</p>
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="absolute top-0 right-0 text-xs text-gray-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>
                    {!user.isGuest && (
                        <div className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left">
                            <label className="ml-1 text-[10px] font-bold uppercase text-gray-500">Change Password</label>
                            <div className="mt-1 flex gap-2">
                                <input type="password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 p-2 text-xs text-white outline-none focus:border-yellow-400" placeholder="New password" />
                                <button type="button" onClick={handlePasswordChange} className="rounded bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500">Update</button>
                            </div>
                        </div>
                    )}
                    {accountMessage && <p className="mt-3 text-xs text-yellow-200">{accountMessage}</p>}
                </div>

                {/* Stats & Balances */}
                <div className="md:col-span-2 flex flex-col gap-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {/* Fun Balance */}
                         <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🪙</div>
                             <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Fun Coins Balance</h3>
                             <div className="text-4xl font-black text-yellow-400">{Math.floor(funCoins).toLocaleString()} <span className="text-lg">FC</span></div>
                         </div>
                         
                         {/* Real Balance */}
                         <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">💵</div>
                             <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Virtual Arcade Credits</h3>
                             <div className="text-4xl font-black text-green-400">{Math.floor(realCoins).toLocaleString()} <span className="text-lg">RC</span></div>
                             <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-green-200/50">No cash value · no withdrawal</p>
                         </div>
                     </div>

                     {/* Recent Activity Preview */}
                     <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-6 flex-1">
                         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                             <span>Recent Activity</span>
                         </h3>
                         <div className="space-y-2">
                             {transactions.length > 0 ? (
                                 transactions.slice(0, 3).map(tx => (
                                    <div key={tx.id} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-200">{tx.reason}</span>
                                            <span className="text-xs text-gray-500">{new Date(tx.timestamp).toLocaleString()}</span>
                                        </div>
                                        <span className={`font-mono font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                            {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                        </span>
                                    </div>
                                 ))
                             ) : (
                                 <div className="text-center text-gray-500 py-8">No transactions yet. Play some games!</div>
                             )}
                         </div>
                         {transactions.length > 3 && (
                             <button 
                                onClick={() => setActiveTab('history')}
                                className="w-full mt-4 text-sm text-gray-400 hover:text-white hover:underline text-center"
                             >
                                 View All Activity
                             </button>
                         )}
                     </div>
                     <div className="rounded-2xl border border-purple-400/25 bg-gray-900/70 p-6">
                         <div className="flex flex-wrap items-center justify-between gap-2">
                             <h3 className="text-lg font-black text-white">🏅 Badges & Banners</h3>
                             <span className="text-xs font-bold text-purple-300">{badges.length} earned</span>
                         </div>
                         <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                             <div className="rounded-xl bg-orange-500/10 p-3 text-orange-200"><strong className="block text-lg">{gamesAt25Plays}/15</strong>Copper: 25 plays in every game</div>
                             <div className="rounded-xl bg-slate-300/10 p-3 text-slate-200"><strong className="block text-lg">{Math.min(6, gamesAt50Usd)}/6</strong>Silver: $50 coin value per game</div>
                             <div className="rounded-xl bg-yellow-400/10 p-3 text-yellow-200"><strong className="block text-lg">{Math.min(6, gamesAt100Usd)}/6</strong>Gold: $100 coin value per game</div>
                             <div className="rounded-xl bg-cyan-300/10 p-3 text-cyan-100"><strong className="block text-lg">{gamesAt100Usd}/15</strong>Platinum: $100 in every game</div>
                         </div>
                         {badges.length > 0 ? (
                             <div className="mt-4 flex flex-wrap gap-2">
                                 {badges.map((badge) => <span key={badge.id} title={badge.description} className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs font-bold text-white">{badge.icon} {badge.name}</span>)}
                             </div>
                         ) : <p className="mt-4 text-sm text-gray-500">Play any game 25 times to earn its named Player badge.</p>}
                         <p className="mt-4 text-[10px] uppercase tracking-wide text-gray-500">Badge value uses 700 game coins = $1 · rewards have no cash value</p>
                     </div>
                </div>
            </div>
        )}

        {/* PROGRESSION TAB */}
        {activeTab === 'progression' && (() => {
            const levelFloor = 250 * Math.pow(progression.level - 1, 2);
            const levelSpan = Math.max(1, progression.nextLevelExperience - levelFloor);
            const levelProgress = Math.max(0, Math.min(100, ((progression.experience - levelFloor) / levelSpan) * 100));
            const faucetReady = !progression.nextFaucetAt || new Date(progression.nextFaucetAt).getTime() <= Date.now();
            const powerupReady = !progression.nextPowerupAt || new Date(progression.nextPowerupAt).getTime() <= Date.now();
            const previewXp = Math.floor(Math.max(0, sacrificeCoins) / 10) + (Math.max(0, sacrificeTickets) * 50);
            return (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-3xl border border-purple-400/25 bg-gradient-to-br from-purple-950/85 via-gray-900/90 to-amber-950/70 p-6 shadow-2xl md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.24em] text-purple-300">Player progression</p>
                      <h2 className="mt-2 text-4xl font-black text-white">Level {progression.level}</h2>
                      <p className="mt-2 text-sm text-gray-300">Sacrifice virtual currency for permanent XP and stronger arcade perks.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
                      <div className="rounded-2xl border border-cyan-400/20 bg-black/25 px-5 py-3"><div className="text-2xl">🎟️</div><strong className="text-xl text-cyan-300">{tickets.toLocaleString()}</strong><small className="block uppercase text-gray-500">Tickets</small></div>
                      <div className="rounded-2xl border border-pink-400/20 bg-black/25 px-5 py-3"><div className="text-2xl">⚡</div><strong className="text-xl text-pink-300">{progression.powerups.toLocaleString()}</strong><small className="block uppercase text-gray-500">Power-ups</small></div>
                      <div className="col-span-2 rounded-2xl border border-yellow-400/20 bg-black/25 px-5 py-3 sm:col-span-1"><div className="text-2xl">✨</div><strong className="text-xl text-yellow-300">{progression.experience.toLocaleString()}</strong><small className="block uppercase text-gray-500">Total XP</small></div>
                    </div>
                  </div>
                  <div className="mt-7">
                    <div className="mb-2 flex justify-between text-xs font-bold text-gray-300"><span>{Math.max(0, progression.experience - levelFloor).toLocaleString()} XP this level</span><span>{Math.max(0, progression.nextLevelExperience - progression.experience).toLocaleString()} XP to level {progression.level + 1}</span></div>
                    <div className="h-4 overflow-hidden rounded-full border border-white/10 bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-yellow-300 transition-all" style={{ width: `${levelProgress}%` }} /></div>
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-2xl border border-red-400/25 bg-gray-900/80 p-6">
                    <h3 className="text-xl font-black text-white">🔥 Sacrifice Vault</h3>
                    <p className="mt-1 text-sm text-gray-400">10 coins = 1 XP · 1 ticket = 50 XP. Sacrifices cannot be undone.</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <label className="text-xs font-bold uppercase text-gray-400">Coins
                        <input type="number" min="0" step="10" max={Math.floor(funCoins)} value={sacrificeCoins} onChange={(event) => setSacrificeCoins(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-yellow-400/25 bg-black/35 p-3 text-lg text-yellow-300 outline-none focus:border-yellow-300" />
                      </label>
                      <label className="text-xs font-bold uppercase text-gray-400">Tickets
                        <input type="number" min="0" step="1" max={tickets} value={sacrificeTickets} onChange={(event) => setSacrificeTickets(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-cyan-400/25 bg-black/35 p-3 text-lg text-cyan-300 outline-none focus:border-cyan-300" />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-black/30 p-3"><span className="text-sm text-gray-400">You receive</span><strong className="text-xl text-purple-300">+{previewXp.toLocaleString()} XP</strong></div>
                    <button type="button" disabled={isProcessing || previewXp < 1 || sacrificeCoins > funCoins || sacrificeTickets > tickets} onClick={handleSacrifice} className="mt-4 w-full rounded-xl bg-gradient-to-r from-red-600 to-purple-600 px-5 py-3 font-black text-white shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Sacrifice for XP</button>
                  </section>

                  <section className="rounded-2xl border border-emerald-400/25 bg-gray-900/80 p-6">
                    <h3 className="text-xl font-black text-white">⛲ Level Faucet</h3>
                    <p className="mt-1 text-sm text-gray-400">Claim once per day. Higher levels increase the daily reward.</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-center"><strong className="text-2xl text-yellow-300">+{progression.faucetAmount.toLocaleString()}</strong><small className="block uppercase text-gray-500">Coins per day</small></div>
                      <div className="rounded-xl border border-pink-400/20 bg-pink-400/5 p-4 text-center"><strong className="text-2xl text-pink-300">+{progression.faucetPowerups}</strong><small className="block uppercase text-gray-500">Power-ups every 4h</small></div>
                    </div>
                    <p className="mt-4 text-center text-xs font-bold text-emerald-300">{faucetReady ? 'READY TO CLAIM' : `Refills ${new Date(progression.nextFaucetAt!).toLocaleString()}`}</p>
                    <button type="button" disabled={isProcessing || !faucetReady || user.isGuest} onClick={handleFaucetClaim} className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 font-black text-white shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Claim Daily Coins</button>
                    <p className="mt-4 text-center text-xs font-bold text-pink-300">{powerupReady ? 'POWER-UP DROP READY' : `Power-ups recharge ${new Date(progression.nextPowerupAt!).toLocaleString()}`}</p>
                    <button type="button" disabled={isProcessing || !powerupReady || user.isGuest} onClick={handlePowerupClaim} className="mt-2 w-full rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-5 py-3 font-black text-white shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Claim Power-up Drop</button>
                    <p className="mt-3 text-center text-xs text-gray-500">Daily coins rise at every level and cap at 2,000 from level 10. Every five levels adds another power-up.</p>
                  </section>
                </div>
                {user.isGuest && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-center text-sm text-amber-200">Create an account to save progression and use the Sacrifice Vault.</p>}
                {progressionMessage && <p role="status" className="rounded-xl border border-purple-400/25 bg-purple-500/10 p-4 text-center font-bold text-purple-100">{progressionMessage}</p>}
              </div>
            );
        })()}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-white">Transaction History</h2>
                    <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setHistoryFilter('all')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${historyFilter === 'all' ? 'bg-yellow-400 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            All
                        </button>
                        <button 
                            onClick={() => setHistoryFilter('gaming')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${historyFilter === 'gaming' ? 'bg-yellow-400 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Gaming
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                                <th className="p-3">Time</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Description</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3 text-right">Currency</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredTransactions.length > 0 ? filteredTransactions.map(tx => (
                                <tr key={tx.id} className="border-b border-gray-800 hover:bg-white/5">
                                    <td className="p-3 text-gray-400">{new Date(tx.timestamp).toLocaleString()}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${tx.type === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="p-3 font-medium text-gray-200">{tx.reason}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                                        {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                    </td>
                                    <td className="p-3 text-right text-gray-500 uppercase">{tx.currency === 'fun' ? 'Fun' : 'Real'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">No transactions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* DEV / GIT TAB */}
        {activeTab === 'dev' && (
            <div className="grid md:grid-cols-3 gap-6">
                {/* Repo Info */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 md:col-span-3 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black text-2xl">
                            <svg height="32" viewBox="0 0 16 16" version="1.1" width="32" aria-hidden="true"><path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">5idescoder/arcade-hub</h2>
                            <p className="text-gray-400 text-sm">Public Repository • TypeScript • React</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-md text-xs text-gray-300">
                             <span className="w-2 h-2 rounded-full bg-green-400"></span>
                             {currentBranch}
                        </div>
                        <button 
                            onClick={handleCreateRepo}
                            disabled={loadingAction === 'create_repo'}
                            className="px-4 py-2 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-md text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {loadingAction === 'create_repo' ? 'Creating...' : 'Create Repo'}
                        </button>
                        <button onClick={handleOpenRepo} className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-sm font-bold transition-colors">
                            View on GitHub
                        </button>
                    </div>
                </div>

                {/* Branch Management */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-white font-bold border-b border-[#30363d] pb-2">Branch Management</h3>
                    
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold">Current Branch</label>
                        <select 
                            value={currentBranch} 
                            onChange={(e) => setCurrentBranch(e.target.value)}
                            className="w-full mt-1 bg-[#21262d] border border-[#30363d] text-white rounded p-2 outline-none focus:border-blue-500"
                        >
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div className="pt-2">
                        <label className="text-xs text-gray-400 uppercase font-bold">Create New Branch</label>
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="text" 
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value)}
                                placeholder="feature/new-game"
                                className="flex-1 bg-[#21262d] border border-[#30363d] text-white rounded p-2 outline-none focus:border-blue-500 text-sm"
                            />
                            <button 
                                onClick={handleCreateBranch}
                                disabled={!newBranchName || loadingAction === 'branch'}
                                className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white px-3 rounded font-bold disabled:opacity-50"
                            >
                                {loadingAction === 'branch' ? '...' : '+'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-[#30363d]">
                        <button 
                            onClick={handlePull} 
                            disabled={loadingAction === 'pull'}
                            className="w-full bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white py-2 rounded font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <span>⬇</span> Pull Origin
                        </button>
                    </div>
                </div>

                {/* Commit & Push */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-6 md:col-span-2 flex flex-col gap-4">
                    <h3 className="text-white font-bold border-b border-[#30363d] pb-2">Commit Changes</h3>
                    
                    <div className="flex-1 bg-[#161b22] rounded border border-[#30363d] p-4 font-mono text-xs text-gray-400 overflow-y-auto max-h-[150px]">
                        <p><span className="text-yellow-400">M</span> components/profile/ProfilePage.tsx</p>
                        <p><span className="text-green-400">A</span> assets/images/avatar_v2.png</p>
                        <p><span className="text-yellow-400">M</span> styles/globals.css</p>
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Commit message..."
                            className="flex-1 bg-[#21262d] border border-[#30363d] text-white rounded p-2 outline-none focus:border-blue-500 text-sm"
                        />
                        <button 
                            onClick={handleCommitAndPush}
                            disabled={!commitMessage || loadingAction === 'commit'}
                            className="bg-[#238636] hover:bg-[#2ea043] text-white px-6 py-2 rounded font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                        >
                            {loadingAction === 'commit' ? 'Pushing...' : 'Commit & Push'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ProfilePage;
