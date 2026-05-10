
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { CurrencyMode, Transaction } from '../types';
import { useAuth } from './AuthContext';

// --- Security Utilities ---
// These are private to this file to prevent external tampering
const SECRET_SALT = 'ARCADE_HUB_SECURE_SALT_v1';

async function generateIntegrityHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataWithSalt = encoder.encode(data + SECRET_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataWithSalt);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function secureSave(key: string, value: any) {
    const stringValue = JSON.stringify(value);
    const hash = await generateIntegrityHash(stringValue);
    localStorage.setItem(key, btoa(stringValue)); // Simple obfuscation
    localStorage.setItem(`${key}_hash`, hash);
}

async function secureLoad(key: string): Promise<any | null> {
    const obfuscatedValue = localStorage.getItem(key);
    const storedHash = localStorage.getItem(`${key}_hash`);
    
    if (!obfuscatedValue || !storedHash) return null;

    try {
        const stringValue = atob(obfuscatedValue);
        const calculatedHash = await generateIntegrityHash(stringValue);
        
        if (calculatedHash !== storedHash) {
            console.error(`Security Alert: Tampering detected in ${key}! Integrity check failed.`);
            return null; // Data is corrupted/tampered
        }
        
        return JSON.parse(stringValue);
    } catch (e) {
        console.error(`Security Alert: Failed to decode ${key}. Data may be corrupted.`);
        return null;
    }
}

interface CoinContextType {
  funCoins: number;
  realCoins: number;
  currencyMode: CurrencyMode;
  setCurrencyMode: (mode: CurrencyMode) => void;
  coins: number; 
  addCoins: (amount: number, reason?: string, targetCurrency?: CurrencyMode) => void;
  subtractCoins: (amount: number, reason?: string, targetCurrency?: CurrencyMode) => boolean;
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
  const [realCoins, setRealCoins] = useState<number>(10);
  const [houseFunds, setHouseFunds] = useState<number>(1000000); 
  const [notification, setNotification] = useState<string | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('fun');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load secure data when user changes
  useEffect(() => {
    const initializeStorage = async () => {
      if (user) {
        const userId = user.id;
        const loadedFun = await secureLoad(`funCoins_${userId}`);
        const loadedReal = await secureLoad(`realCoins_${userId}`);
        const loadedTx = await secureLoad(`transactions_${userId}`);
        
        // If loaded data is null (failed integrity check), we reset to defaults for safety
        if (loadedFun !== null) setFunCoins(Number(loadedFun));
        if (loadedReal !== null) setRealCoins(Number(loadedReal));
        if (loadedTx !== null) setTransactions(loadedTx);
      } else {
        setFunCoins(1000);
        setRealCoins(10);
        setTransactions([]);
      }
      setIsLoaded(true);
    };

    initializeStorage();
  }, [user]);

  // Save balances whenever they change, but only after initial load
  useEffect(() => {
    if (!isLoaded || !user) return;

    const saveBalances = async () => {
        await secureSave(`funCoins_${user.id}`, funCoins);
        await secureSave(`realCoins_${user.id}`, realCoins);
    };
    saveBalances();
  }, [funCoins, realCoins, user, isLoaded]);

  // Save transactions
  useEffect(() => {
    if (!isLoaded || !user) return;

    const saveTransactions = async () => {
        await secureSave(`transactions_${user.id}`, transactions);
    };
    saveTransactions();
  }, [transactions, user, isLoaded]);


  const activeBalance = currencyMode === 'fun' ? funCoins : realCoins;
  const updateActiveBalance = currencyMode === 'fun' ? setFunCoins : setRealCoins;

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

  const addCoins = useCallback((amount: number, reason: string = 'Game Win', targetCurrency?: CurrencyMode) => {
    if (amount <= 0) return;
    
    const target = targetCurrency || currencyMode;
    if (target === 'real' && amount > houseFunds) {
        setNotification('House funds are too low for this payout.');
        return;
    }

    setIsProcessing(true);
    
    if (target === 'fun') {
        setFunCoins(prev => prev + amount);
    } else {
        setRealCoins(prev => prev + amount);
        setHouseFunds(prev => prev - amount);
    }
    
    logTransaction('credit', amount, reason, target);
    
    // Tiny delay to ensure React state batching completes before releasing lock
    setTimeout(() => setIsProcessing(false), 50);
  }, [currencyMode, logTransaction, houseFunds]);

  const subtractCoins = useCallback((amount: number, reason: string = 'Game Bet', targetCurrency?: CurrencyMode): boolean => {
    if (amount <= 0 || isProcessing) return false;

    const target = targetCurrency || currencyMode;
    const balance = target === 'fun' ? funCoins : realCoins;

    // Check balance before locking
    if (balance >= amount) {
      setIsProcessing(true);
      
      if (target === 'fun') {
          setFunCoins(prev => prev - amount);
      } else {
          setRealCoins(prev => prev - amount);
      }
      
      logTransaction('debit', amount, reason, target);
      
      setTimeout(() => setIsProcessing(false), 50);
      return true;
    }
    
    return false;
  }, [funCoins, realCoins, currencyMode, isProcessing, logTransaction]);

  const resetCoins = useCallback(() => {
      setFunCoins(1000);
      setRealCoins(10);
      setTransactions([]);
  }, []);

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
