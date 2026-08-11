import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AestheticPurchaseReward, CurrencyMode, GameAesthetic, PlayerGameStat, Transaction } from '../types';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useAdminSettings } from './AdminSettingsContext';
import { DAILY_FAUCET_COOLDOWN_MS, dailyFaucetAmountForLevel } from '../lib/progressionRewards';

interface CoinContextType {
  funCoins: number;
  realCoins: number;
  tickets: number;
  progression: PlayerProgression;
  aesthetics: GameAesthetic[];
  ownedAestheticIds: string[];
  equippedAesthetics: Record<string, string>;
  gameStats: PlayerGameStat[];
  currencyMode: CurrencyMode;
  setCurrencyMode: (mode: CurrencyMode) => void;
  coins: number;
  addCoins: (amount: number, reason?: string, targetCurrency?: CurrencyMode) => Promise<boolean>;
  subtractCoins: (amount: number, reason?: string, targetCurrency?: CurrencyMode) => Promise<boolean>;
  sacrificeForExperience: (coins: number, tickets: number) => Promise<ProgressionReward | null>;
  claimLevelFaucet: () => Promise<ProgressionReward | null>;
  claimLevelPowerups: () => Promise<number | null>;
  purchaseAesthetic: (aestheticId: string) => Promise<AestheticPurchaseReward | null>;
  equipAesthetic: (aestheticId: string) => Promise<boolean>;
  syncBalance: () => Promise<void>;
  resetCoins: () => Promise<void>;
  setCoinBalances: (funAmount: number, virtualAmount: number) => Promise<void>;
  canBet: (amount: number) => boolean;
  transactions: Transaction[];
  isProcessing: boolean;
  houseFunds: number;
  notification: string | null;
  clearNotification: () => void;
}

export interface PlayerProgression {
  experience: number;
  level: number;
  powerups: number;
  nextLevelExperience: number;
  faucetAmount: number;
  faucetPowerups: number;
  nextFaucetAt: string | null;
  nextPowerupAt: string | null;
}

export interface ProgressionReward extends PlayerProgression {
  experienceGained: number;
  levelsGained: number;
}

const initialProgression: PlayerProgression = {
  experience: 0,
  level: 1,
  powerups: 0,
  nextLevelExperience: 250,
  faucetAmount: 75,
  faucetPowerups: 1,
  nextFaucetAt: null,
  nextPowerupAt: null,
};

const CoinContext = createContext<CoinContextType | undefined>(undefined);

export const CoinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { payoutMultiplierForReason } = useAdminSettings();
  const [funCoins, setFunCoins] = useState(1000);
  const [realCoins, setRealCoins] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [progression, setProgression] = useState<PlayerProgression>(initialProgression);
  const [aesthetics, setAesthetics] = useState<GameAesthetic[]>([]);
  const [ownedAestheticIds, setOwnedAestheticIds] = useState<string[]>([]);
  const [equippedAesthetics, setEquippedAesthetics] = useState<Record<string, string>>({});
  const [gameStats, setGameStats] = useState<PlayerGameStat[]>([]);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('fun');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const storageSuffix = user?.id ?? 'guest';
  const funKey = `arcade_fun_coins_${storageSuffix}`;
  const virtualKey = `arcade_virtual_credits_${storageSuffix}`;

  const loadBalances = useCallback(async () => {
    if (!user || user.isGuest) {
      const savedFun = Number(window.localStorage.getItem(funKey));
      const savedVirtual = Number(window.localStorage.getItem(virtualKey));
      setFunCoins(Number.isFinite(savedFun) && savedFun >= 0 ? savedFun : 1000);
      setRealCoins(Number.isFinite(savedVirtual) && savedVirtual >= 0 ? savedVirtual : 0);
      setTickets(0);
      setProgression(initialProgression);
      setAesthetics([]);
      setOwnedAestheticIds([]);
      setEquippedAesthetics({});
      setGameStats([]);
      setTransactions([]);
      return;
    }

    const supabase = getSupabase();
    const [
      { data: balance, error: balanceError },
      { data: progress, error: progressError },
      { data: history, error: historyError },
      { data: catalog, error: catalogError },
      { data: owned, error: ownedError },
      { data: stats, error: statsError },
    ] = await Promise.all([
      supabase.from('player_balances').select('fun_coins, real_coins, tickets').eq('user_id', user.id).single(),
      supabase.from('player_progression').select('experience, level, powerups, last_faucet_claimed_at, last_powerup_claimed_at').eq('user_id', user.id).single(),
      supabase.from('coin_transactions').select('id, currency, transaction_type, amount, reason, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('game_aesthetics').select('id, game_id, name, description, visual_key, ticket_cost, required_experience, value_cents, reward_type, reward_amount, gradient_from, gradient_to, accent_color, sort_order').order('game_id').order('sort_order'),
      supabase.from('player_aesthetics').select('aesthetic_id, game_id, equipped').eq('user_id', user.id),
      supabase.from('player_game_stats').select('game_id, play_count, coins_spent').eq('user_id', user.id),
    ]);
    if (balanceError) throw balanceError;
    if (progressError) throw progressError;
    if (historyError) throw historyError;
    if (catalogError) throw catalogError;
    if (ownedError) throw ownedError;
    if (statsError) throw statsError;

    setFunCoins(Number(balance.fun_coins));
    setRealCoins(Number(balance.real_coins));
    setTickets(Number(balance.tickets));
    const level = Number(progress.level);
    const lastFaucet = progress.last_faucet_claimed_at ? new Date(progress.last_faucet_claimed_at) : null;
    const lastPowerup = progress.last_powerup_claimed_at ? new Date(progress.last_powerup_claimed_at) : null;
    setProgression({
      experience: Number(progress.experience),
      level,
      powerups: Number(progress.powerups),
      nextLevelExperience: 250 * level * level,
      faucetAmount: dailyFaucetAmountForLevel(level),
      faucetPowerups: Math.min(5, 1 + Math.floor((level - 1) / 5)),
      nextFaucetAt: lastFaucet ? new Date(lastFaucet.getTime() + DAILY_FAUCET_COOLDOWN_MS).toISOString() : null,
      nextPowerupAt: lastPowerup ? new Date(lastPowerup.getTime() + (4 * 60 * 60 * 1000)).toISOString() : null,
    });
    setAesthetics((catalog ?? []).map((item) => ({
      id: item.id,
      gameId: item.game_id,
      name: item.name,
      description: item.description,
      visualKey: item.visual_key,
      ticketCost: Number(item.ticket_cost),
      requiredExperience: Number(item.required_experience),
      valueCents: Number(item.value_cents),
      rewardType: item.reward_type,
      rewardAmount: Number(item.reward_amount),
      gradientFrom: item.gradient_from,
      gradientTo: item.gradient_to,
      accentColor: item.accent_color,
      sortOrder: Number(item.sort_order),
    })));
    setOwnedAestheticIds((owned ?? []).map((item) => item.aesthetic_id));
    setEquippedAesthetics(Object.fromEntries((owned ?? []).filter((item) => item.equipped).map((item) => [item.game_id, item.aesthetic_id])));
    setGameStats((stats ?? []).map((item) => ({ gameId: item.game_id, playCount: Number(item.play_count), coinsSpent: Number(item.coins_spent) })));
    setTransactions((history ?? []).map((row) => ({
      id: String(row.id),
      type: row.transaction_type as 'credit' | 'debit',
      amount: Number(row.amount),
      currency: row.currency as CurrencyMode,
      reason: row.reason,
      timestamp: new Date(row.created_at).getTime(),
    })));
  }, [funKey, user, virtualKey]);

  useEffect(() => {
    void loadBalances().catch((error) => {
      console.error('Unable to load player balances', error);
      setNotification('Could not synchronize your virtual balance.');
    });
  }, [loadBalances]);

  const logLocalTransaction = useCallback((type: 'credit' | 'debit', amount: number, reason: string, currency: CurrencyMode) => {
    const transaction: Transaction = { id: `${Date.now()}${Math.random().toString(36).slice(2)}`, type, amount, currency, reason, timestamp: Date.now() };
    setTransactions((current) => [transaction, ...current].slice(0, 100));
  }, []);

  const applyTransaction = useCallback(async (type: 'credit' | 'debit', amount: number, reason: string, target: CurrencyMode) => {
    if (!user || user.isGuest) {
      const current = target === 'fun' ? funCoins : realCoins;
      if (type === 'debit' && current < amount) return false;
      const next = type === 'credit' ? current + amount : current - amount;
      if (target === 'fun') { setFunCoins(next); window.localStorage.setItem(funKey, String(next)); }
      else { setRealCoins(next); window.localStorage.setItem(virtualKey, String(next)); }
      logLocalTransaction(type, amount, reason, target);
      return true;
    }

    const { data, error } = await getSupabase().rpc('apply_coin_transaction', {
      p_user_id: user.id,
      p_currency: target,
      p_transaction_type: type,
      p_amount: amount,
      p_reason: reason.slice(0, 120),
    });
    if (error) {
      setNotification(error.message);
      return false;
    }
    const balance = Array.isArray(data) ? data[0] : data;
    setFunCoins(Number(balance.fun_coins));
    setRealCoins(Number(balance.real_coins));
    setTransactions((current) => [{ id: crypto.randomUUID(), type, amount, currency: target, reason, timestamp: Date.now() }, ...current].slice(0, 100));
    return true;
  }, [funCoins, funKey, logLocalTransaction, realCoins, user, virtualKey]);

  const addCoins = useCallback(async (amount: number, reason = 'Game Win', targetCurrency?: CurrencyMode) => {
    const target = targetCurrency ?? currencyMode;
    const adjusted = Math.max(0, Math.round(amount * payoutMultiplierForReason(reason) * 100) / 100);
    if (!Number.isFinite(adjusted) || adjusted <= 0 || isProcessing) return false;
    setIsProcessing(true);
    try { return await applyTransaction('credit', adjusted, reason, target); }
    finally { setIsProcessing(false); }
  }, [applyTransaction, currencyMode, isProcessing, payoutMultiplierForReason]);

  const subtractCoins = useCallback(async (amount: number, reason = 'Game Bet', targetCurrency?: CurrencyMode) => {
    const target = targetCurrency ?? currencyMode;
    const balance = target === 'fun' ? funCoins : realCoins;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance || isProcessing) return false;
    setIsProcessing(true);
    try { return await applyTransaction('debit', amount, reason, target); }
    finally { setIsProcessing(false); }
  }, [applyTransaction, currencyMode, funCoins, isProcessing, realCoins]);

  const applyProgressionReward = useCallback((raw: any): ProgressionReward => {
    const reward: ProgressionReward = {
      experience: Number(raw.experience),
      level: Number(raw.level),
      powerups: Number(raw.powerups),
      experienceGained: Number(raw.experience_gained),
      levelsGained: Number(raw.levels_gained),
      nextLevelExperience: Number(raw.next_level_experience),
      faucetAmount: Number(raw.faucet_amount),
      faucetPowerups: Number(raw.faucet_powerups),
      nextFaucetAt: raw.next_faucet_at ? String(raw.next_faucet_at) : null,
      nextPowerupAt: progression.nextPowerupAt,
    };
    setFunCoins(Number(raw.fun_coins));
    setTickets(Number(raw.tickets));
    setProgression(reward);
    return reward;
  }, [progression.nextPowerupAt]);

  const sacrificeForExperience = useCallback(async (coins: number, ticketAmount: number) => {
    if (!user || user.isGuest || isProcessing) return null;
    const cleanCoins = Math.floor(coins);
    const cleanTickets = Math.floor(ticketAmount);
    if (cleanCoins < 0 || cleanTickets < 0 || (cleanCoins === 0 && cleanTickets === 0)) return null;
    setIsProcessing(true);
    try {
      const { data, error } = await getSupabase().rpc('sacrifice_for_experience', {
        p_user_id: user.id,
        p_coins: cleanCoins,
        p_tickets: cleanTickets,
      });
      if (error) { setNotification(error.message); return null; }
      const row = Array.isArray(data) ? data[0] : data;
      const reward = applyProgressionReward(row);
      if (cleanCoins > 0) logLocalTransaction('debit', cleanCoins, 'XP Sacrifice', 'fun');
      return reward;
    } finally { setIsProcessing(false); }
  }, [applyProgressionReward, isProcessing, logLocalTransaction, user]);

  const claimLevelFaucet = useCallback(async () => {
    if (!user || user.isGuest || isProcessing) return null;
    setIsProcessing(true);
    try {
      const { data, error } = await getSupabase().rpc('claim_level_faucet', { p_user_id: user.id });
      if (error) { setNotification(error.message); return null; }
      const row = Array.isArray(data) ? data[0] : data;
      const reward = applyProgressionReward(row);
      logLocalTransaction('credit', reward.faucetAmount, 'Daily Level Faucet', 'fun');
      return reward;
    } finally { setIsProcessing(false); }
  }, [applyProgressionReward, isProcessing, logLocalTransaction, user]);

  const claimLevelPowerups = useCallback(async () => {
    if (!user || user.isGuest || isProcessing) return null;
    setIsProcessing(true);
    try {
      const { data, error } = await getSupabase().rpc('claim_level_powerups', { p_user_id: user.id });
      if (error) { setNotification(error.message); return null; }
      const reward = data as { rewardAmount: number; powerups: number; nextPowerupAt: string | null };
      const rewardAmount = Number(reward.rewardAmount);
      setProgression((current) => ({
        ...current,
        powerups: Number(reward.powerups),
        nextPowerupAt: reward.nextPowerupAt ? String(reward.nextPowerupAt) : null,
      }));
      return rewardAmount;
    } finally { setIsProcessing(false); }
  }, [isProcessing, user]);

  const purchaseAesthetic = useCallback(async (aestheticId: string) => {
    if (!user || user.isGuest || isProcessing) return null;
    setIsProcessing(true);
    try {
      const { data, error } = await getSupabase().rpc('purchase_game_aesthetic', {
        p_user_id: user.id,
        p_aesthetic_id: aestheticId,
      });
      if (error) { setNotification(error.message); return null; }
      const reward = data as AestheticPurchaseReward;
      await loadBalances();
      return reward;
    } finally { setIsProcessing(false); }
  }, [isProcessing, loadBalances, user]);

  const equipAesthetic = useCallback(async (aestheticId: string) => {
    if (!user || user.isGuest || isProcessing) return false;
    setIsProcessing(true);
    try {
      const { error } = await getSupabase().rpc('equip_game_aesthetic', {
        p_user_id: user.id,
        p_aesthetic_id: aestheticId,
      });
      if (error) { setNotification(error.message); return false; }
      await loadBalances();
      return true;
    } finally { setIsProcessing(false); }
  }, [isProcessing, loadBalances, user]);

  const setCoinBalances = useCallback(async (funAmount: number, virtualAmount: number) => {
    const cleanFun = Math.max(0, Number.isFinite(funAmount) ? funAmount : 0);
    const cleanVirtual = Math.max(0, Number.isFinite(virtualAmount) ? virtualAmount : 0);
    if (!user || user.isGuest) {
      setFunCoins(cleanFun); setRealCoins(cleanVirtual); setTransactions([]);
      window.localStorage.setItem(funKey, String(cleanFun));
      window.localStorage.setItem(virtualKey, String(cleanVirtual));
      return;
    }
    const funDifference = cleanFun - funCoins;
    const realDifference = cleanVirtual - realCoins;
    if (funDifference !== 0) await applyTransaction(funDifference > 0 ? 'credit' : 'debit', Math.abs(funDifference), 'Admin Balance Adjustment', 'fun');
    if (realDifference !== 0) await applyTransaction(realDifference > 0 ? 'credit' : 'debit', Math.abs(realDifference), 'Admin Balance Adjustment', 'real');
  }, [applyTransaction, funCoins, funKey, realCoins, user, virtualKey]);

  const resetCoins = useCallback(() => setCoinBalances(1000, 0), [setCoinBalances]);
  const syncBalance = useCallback(() => loadBalances(), [loadBalances]);
  const clearNotification = useCallback(() => setNotification(null), []);
  const activeBalance = currencyMode === 'fun' ? funCoins : realCoins;
  const canBet = useCallback((amount: number) => Number.isFinite(amount) && amount > 0 && activeBalance >= amount && !isProcessing, [activeBalance, isProcessing]);
  const value = useMemo(() => ({
    funCoins, realCoins, tickets, progression, aesthetics, ownedAestheticIds, equippedAesthetics, gameStats,
    currencyMode, setCurrencyMode, coins: activeBalance, addCoins, subtractCoins,
    sacrificeForExperience, claimLevelFaucet, claimLevelPowerups, purchaseAesthetic, equipAesthetic,
    syncBalance, resetCoins, setCoinBalances, canBet, transactions, isProcessing, houseFunds: Number.MAX_SAFE_INTEGER,
    notification, clearNotification,
  }), [activeBalance, addCoins, aesthetics, canBet, claimLevelFaucet, claimLevelPowerups, clearNotification, currencyMode, equipAesthetic, equippedAesthetics, funCoins, gameStats, isProcessing, notification, ownedAestheticIds, progression, purchaseAesthetic, realCoins, resetCoins, sacrificeForExperience, setCoinBalances, subtractCoins, syncBalance, tickets, transactions]);

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
};

export const useCoinSystem = () => {
  const context = useContext(CoinContext);
  if (!context) throw new Error('useCoinSystem must be used within CoinProvider');
  return context;
};
