import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CurrencyMode, Transaction } from '../types';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useAdminSettings } from './AdminSettingsContext';

interface CoinContextType {
  funCoins: number;
  realCoins: number;
  currencyMode: CurrencyMode;
  setCurrencyMode: (mode: CurrencyMode) => void;
  coins: number;
  addCoins: (amount: number, reason?: string, targetCurrency?: CurrencyMode) => Promise<boolean>;
  subtractCoins: (amount: number, reason?: string, targetCurrency?: CurrencyMode) => Promise<boolean>;
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

const CoinContext = createContext<CoinContextType | undefined>(undefined);

export const CoinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { payoutMultiplierForReason } = useAdminSettings();
  const [funCoins, setFunCoins] = useState(1000);
  const [realCoins, setRealCoins] = useState(0);
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
      setTransactions([]);
      return;
    }

    const supabase = getSupabase();
    const [{ data: balance, error: balanceError }, { data: history, error: historyError }] = await Promise.all([
      supabase.from('player_balances').select('fun_coins, real_coins').eq('user_id', user.id).single(),
      supabase.from('coin_transactions').select('id, currency, transaction_type, amount, reason, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (balanceError) throw balanceError;
    if (historyError) throw historyError;

    setFunCoins(Number(balance.fun_coins));
    setRealCoins(Number(balance.real_coins));
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
    funCoins, realCoins, currencyMode, setCurrencyMode, coins: activeBalance, addCoins, subtractCoins,
    syncBalance, resetCoins, setCoinBalances, canBet, transactions, isProcessing, houseFunds: Number.MAX_SAFE_INTEGER,
    notification, clearNotification,
  }), [activeBalance, addCoins, canBet, clearNotification, currencyMode, funCoins, isProcessing, notification, realCoins, resetCoins, setCoinBalances, subtractCoins, syncBalance, transactions]);

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
};

export const useCoinSystem = () => {
  const context = useContext(CoinContext);
  if (!context) throw new Error('useCoinSystem must be used within CoinProvider');
  return context;
};
