
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { CurrencyMode, Transaction } from '../types';
import { useAuth } from './AuthContext';

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
  const [funCoins, setFunCoins] = useState<number>(1000);
  const [realCoins, setRealCoins] = useState<number>(0);
  const [houseFunds, setHouseFunds] = useState<number>(1000000); 
  const [notification, setNotification] = useState<string | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('fun');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const localFunCoinsKey = user ? `arcade_fun_coins_${user.id}` : 'arcade_fun_coins_guest';

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
            setFunCoins(Number.isFinite(savedFunCoins) && savedFunCoins >= 0 ? savedFunCoins : 1000);
        }
      } else {
        setFunCoins(1000);
        setRealCoins(0);
        setTransactions([]);
      }
      setIsLoaded(true);
    };

    initializeFromBackend();
  }, [user, localFunCoinsKey]);

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
    
    const target = targetCurrency || currencyMode;
    if (target === 'real' && amount > houseFunds) {
        setNotification('House funds are too low for this payout.');
        return false;
    }

    setIsProcessing(true);
    
    const result = await fetchFromBackend('/game/result', 'POST', {
        wallet: user.id,
        type: 'credit',
        amount,
        reason,
        currency: target
    }, user.id);

    if (result && result.success) {
        if (target === 'fun') setFunCoins(result.funCoins);
        else setRealCoins(result.realCoins);
        logTransaction('credit', amount, reason, target);
        setIsProcessing(false);
        return true;
    }

    if (!result && target === 'fun') {
        setFunCoins(current => {
            const next = current + amount;
            localStorage.setItem(localFunCoinsKey, String(next));
            return next;
        });
        logTransaction('credit', amount, reason, target);
        setIsProcessing(false);
        return true;
    }

    if (!result && target === 'real') setNotification('Real Coin service is offline. Switch to Fun Coins to play locally.');

    setIsProcessing(false);
    return false;
  }, [currencyMode, localFunCoinsKey, logTransaction, houseFunds, user]);

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
      setTransactions([]);
  }, [localFunCoinsKey]);

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
