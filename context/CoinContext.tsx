
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { CurrencyMode, Transaction } from '../types';
import { useAuth } from './AuthContext';
import { useAdminSettings } from './AdminSettingsContext';

// --- API Utilities ---
const API_BASE = 'http://localhost:3001/api';

async function fetchFromBackend(endpoint: string, method: string = 'GET', body?: any, wallet?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (wallet) headers['x-wallet-address'] = wallet;

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        return await response.json();
    } catch (error) {
        console.error(`Backend Error (${endpoint}):`, error);
        return null;
    }
}

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
  setCoinBalances: (funAmount: number, realAmount: number) => void;
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
  const [funCoins, setFunCoins] = useState<number>(1000);
  const [realCoins, setRealCoins] = useState<number>(0);
  const [houseFunds, setHouseFunds] = useState<number>(1000000); 
  const [notification, setNotification] = useState<string | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('fun');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const localFunCoinsKey = user ? `arcade_fun_coins_${user.id}` : 'arcade_fun_coins_guest';
  const localRealCoinsKey = user ? `arcade_real_coins_${user.id}` : 'arcade_real_coins_guest';

  // Load data from backend when user changes
  useEffect(() => {
    const initializeFromBackend = async () => {
      if (user) {
        const userId = user.id; // Wallet address
        const data = await fetchFromBackend('/auth', 'POST', { wallet: userId });
        
        if (data) {
            setFunCoins(data.funCoins);
            setRealCoins(data.realCoins);
        } else {
            const savedFunCoins = Number(localStorage.getItem(localFunCoinsKey));
            const savedRealCoins = Number(localStorage.getItem(localRealCoinsKey));
            setFunCoins(Number.isFinite(savedFunCoins) && savedFunCoins >= 0 ? savedFunCoins : 1000);
            setRealCoins(Number.isFinite(savedRealCoins) && savedRealCoins >= 0 ? savedRealCoins : 0);
        }
      } else {
        const savedFunCoins = Number(localStorage.getItem(localFunCoinsKey));
        const savedRealCoins = Number(localStorage.getItem(localRealCoinsKey));
        setFunCoins(Number.isFinite(savedFunCoins) && savedFunCoins >= 0 ? savedFunCoins : 1000);
        setRealCoins(Number.isFinite(savedRealCoins) && savedRealCoins >= 0 ? savedRealCoins : 0);
        setTransactions([]);
      }
      setIsLoaded(true);
    };

    initializeFromBackend();
  }, [user, localFunCoinsKey, localRealCoinsKey]);

  const activeBalance = currencyMode === 'fun' ? funCoins : realCoins;

  const logTransaction = useCallback((type: 'credit' | 'debit', amount: number, reason: string, currency: CurrencyMode = currencyMode) => {
    const newTx: Transaction = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        type,
        amount,
        currency,
        reason,
        timestamp: Date.now()
    };
    setTransactions(prev => [newTx, ...prev].slice(0, 100));
  }, [currencyMode]);

  const clearNotification = useCallback(() => setNotification(null), []);

  const addCoins = useCallback(async (amount: number, reason: string = 'Game Win', targetCurrency?: CurrencyMode) => {
    if (amount <= 0 || !user) return false;
    const adjustedAmount = Math.max(0, Math.round(amount * payoutMultiplierForReason(reason) * 100) / 100);
    if (adjustedAmount <= 0) return true;
    const target = targetCurrency || currencyMode;
    if (target === 'real' && adjustedAmount > houseFunds) {
        setNotification('House funds are too low for this payout.');
        return false;
    }

    setIsProcessing(true);
    
    const result = await fetchFromBackend('/game/result', 'POST', {
        wallet: user.id,
        type: 'credit',
        amount: adjustedAmount,
        reason,
        currency: target
    }, user.id);

    if (result && result.success) {
        if (target === 'fun') setFunCoins(result.funCoins);
        else setRealCoins(result.realCoins);
        logTransaction('credit', adjustedAmount, reason, target);
        setIsProcessing(false);
        return true;
    }

    if (!result && target === 'fun') {
        setFunCoins(current => {
            const next = current + adjustedAmount;
            localStorage.setItem(localFunCoinsKey, String(next));
            return next;
        });
        logTransaction('credit', adjustedAmount, reason, target);
        setIsProcessing(false);
        return true;
    }

    if (!result && target === 'real') setNotification('Real Coin service is offline. Switch to Fun Coins to play locally.');

    setIsProcessing(false);
    return false;
  }, [currencyMode, localFunCoinsKey, logTransaction, houseFunds, payoutMultiplierForReason, user]);

  const subtractCoins = useCallback(async (amount: number, reason: string = 'Game Bet', targetCurrency?: CurrencyMode): Promise<boolean> => {
    if (amount <= 0 || isProcessing || !user) return false;

    const target = targetCurrency || currencyMode;

    setIsProcessing(true);

    const result = await fetchFromBackend('/game/result', 'POST', {
        wallet: user.id,
        type: 'debit',
        amount,
        reason,
        currency: target
    }, user.id);

    if (result && result.success) {
        if (target === 'fun') setFunCoins(result.funCoins);
        else setRealCoins(result.realCoins);
        logTransaction('debit', amount, reason, target);
        setIsProcessing(false);
        return true;
    }

    if (!result && target === 'fun' && funCoins >= amount) {
        const next = funCoins - amount;
        setFunCoins(next);
        localStorage.setItem(localFunCoinsKey, String(next));
        logTransaction('debit', amount, reason, target);
        setIsProcessing(false);
        return true;
    }

    if (!result && target === 'real') setNotification('Real Coin service is offline. Switch to Fun Coins to play locally.');
    
    setIsProcessing(false);
    return false;
  }, [currencyMode, funCoins, isProcessing, localFunCoinsKey, logTransaction, user]);

  const syncBalance = useCallback(async () => {
    if (user) {
        const data = await fetchFromBackend('/balance', 'GET', undefined, user.id);
      if (data) {
          setFunCoins(data.funCoins);
          setRealCoins(data.realCoins);
      } else {
          const savedFunCoins = Number(localStorage.getItem(localFunCoinsKey));
          if (Number.isFinite(savedFunCoins) && savedFunCoins >= 0) setFunCoins(savedFunCoins);
      }
    }
  }, [user, localFunCoinsKey]);

  const resetCoins = useCallback(() => {
      setFunCoins(1000);
      localStorage.setItem(localFunCoinsKey, '1000');
      setRealCoins(0);
      localStorage.setItem(localRealCoinsKey, '0');
      setTransactions([]);
  }, [localFunCoinsKey, localRealCoinsKey]);

  const setCoinBalances = useCallback((funAmount: number, realAmount: number) => {
      const cleanFun = Math.max(0, Number.isFinite(funAmount) ? funAmount : 0);
      const cleanReal = Math.max(0, Number.isFinite(realAmount) ? realAmount : 0);
      setFunCoins(cleanFun);
      setRealCoins(cleanReal);
      localStorage.setItem(localFunCoinsKey, String(cleanFun));
      localStorage.setItem(localRealCoinsKey, String(cleanReal));
      setTransactions([]);
  }, [localFunCoinsKey, localRealCoinsKey]);

  const canBet = useCallback((amount: number) => {
    return activeBalance >= amount && amount > 0 && !isProcessing;
  }, [activeBalance, isProcessing]);

  return (
    <CoinContext.Provider value={{ 
      funCoins, 
      realCoins, 
      currencyMode, 
      setCurrencyMode,
      coins: activeBalance,
      addCoins, 
      subtractCoins, 
      syncBalance,
      resetCoins,
      setCoinBalances,
      canBet,
      transactions,
      isProcessing,
      houseFunds,
      notification,
      clearNotification
      }}
      >

      {children}
    </CoinContext.Provider>
  );
};

export const useCoinSystem = (): CoinContextType => {
  const context = useContext(CoinContext);
  if (context === undefined) {
    throw new Error('useCoinSystem must be used within a CoinProvider');
  }
  return context;
};
