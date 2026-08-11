import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CurrencyMode, Transaction } from '../types';
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
  resetCoins: () => void;
  setCoinBalances: (funAmount: number, virtualAmount: number) => void;
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

  const readBalances = useCallback(() => {
    const savedFun = Number(window.localStorage.getItem(funKey));
    const savedVirtual = Number(window.localStorage.getItem(virtualKey));
    setFunCoins(Number.isFinite(savedFun) && savedFun >= 0 ? savedFun : 1000);
    setRealCoins(Number.isFinite(savedVirtual) && savedVirtual >= 0 ? savedVirtual : 0);
  }, [funKey, virtualKey]);

  useEffect(() => { readBalances(); setTransactions([]); }, [readBalances]);

  const logTransaction = useCallback((type: 'credit' | 'debit', amount: number, reason: string, currency: CurrencyMode) => {
    const transaction: Transaction = {
      id: `${Date.now()}${Math.random().toString(36).slice(2)}`,
      type, amount, currency, reason, timestamp: Date.now()
    };
    setTransactions((current) => [transaction, ...current].slice(0, 100));
  }, []);

  const addCoins = useCallback(async (amount: number, reason = 'Game Win', targetCurrency?: CurrencyMode) => {
    const target = targetCurrency ?? currencyMode;
    const adjusted = Math.max(0, Math.round(amount * payoutMultiplierForReason(reason) * 100) / 100);
    if (!Number.isFinite(adjusted) || adjusted <= 0) return false;
    setIsProcessing(true);
    if (target === 'fun') {
      setFunCoins((current) => { const next = current + adjusted; window.localStorage.setItem(funKey, String(next)); return next; });
    } else {
      setRealCoins((current) => { const next = current + adjusted; window.localStorage.setItem(virtualKey, String(next)); return next; });
    }
    logTransaction('credit', adjusted, reason, target);
    setIsProcessing(false);
    return true;
  }, [currencyMode, funKey, logTransaction, payoutMultiplierForReason, virtualKey]);

  const subtractCoins = useCallback(async (amount: number, reason = 'Game Bet', targetCurrency?: CurrencyMode) => {
    const target = targetCurrency ?? currencyMode;
    const balance = target === 'fun' ? funCoins : realCoins;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance || isProcessing) return false;
    setIsProcessing(true);
    const next = balance - amount;
    if (target === 'fun') { setFunCoins(next); window.localStorage.setItem(funKey, String(next)); }
    else { setRealCoins(next); window.localStorage.setItem(virtualKey, String(next)); }
    logTransaction('debit', amount, reason, target);
    setIsProcessing(false);
    return true;
  }, [currencyMode, funCoins, funKey, isProcessing, logTransaction, realCoins, virtualKey]);

  const setCoinBalances = useCallback((funAmount: number, virtualAmount: number) => {
    const cleanFun = Math.max(0, Number.isFinite(funAmount) ? funAmount : 0);
    const cleanVirtual = Math.max(0, Number.isFinite(virtualAmount) ? virtualAmount : 0);
    setFunCoins(cleanFun); setRealCoins(cleanVirtual); setTransactions([]);
    window.localStorage.setItem(funKey, String(cleanFun));
    window.localStorage.setItem(virtualKey, String(cleanVirtual));
  }, [funKey, virtualKey]);

  const resetCoins = useCallback(() => setCoinBalances(1000, 0), [setCoinBalances]);
  const syncBalance = useCallback(async () => readBalances(), [readBalances]);
  const clearNotification = useCallback(() => setNotification(null), []);
  const activeBalance = currencyMode === 'fun' ? funCoins : realCoins;
  const canBet = useCallback((amount: number) => Number.isFinite(amount) && amount > 0 && activeBalance >= amount && !isProcessing, [activeBalance, isProcessing]);
  const value = useMemo(() => ({
    funCoins, realCoins, currencyMode, setCurrencyMode, coins: activeBalance, addCoins, subtractCoins,
    syncBalance, resetCoins, setCoinBalances, canBet, transactions, isProcessing, houseFunds: Number.MAX_SAFE_INTEGER,
    notification, clearNotification
  }), [activeBalance, addCoins, canBet, clearNotification, currencyMode, funCoins, isProcessing, notification, realCoins, resetCoins, setCoinBalances, subtractCoins, syncBalance, transactions]);

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
};

export const useCoinSystem = () => {
  const context = useContext(CoinContext);
  if (!context) throw new Error('useCoinSystem must be used within CoinProvider');
  return context;
};
