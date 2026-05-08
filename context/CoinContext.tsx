
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { CurrencyMode, Transaction } from '../types';
import { useAuth } from './AuthContext';

interface CoinContextType {
  funCoins: number;
  realCoins: number;
  currencyMode: CurrencyMode;
  setCurrencyMode: (mode: CurrencyMode) => void;
  coins: number; // Represents the active currency balance
  addCoins: (amount: number, reason?: string) => void;
  subtractCoins: (amount: number, reason?: string) => boolean;
  resetCoins: () => void;
  canBet: (amount: number) => boolean;
  transactions: Transaction[];
}

const CoinContext = createContext<CoinContextType | undefined>(undefined);

export const CoinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [funCoins, setFunCoins] = useState<number>(1000);
  const [realCoins, setRealCoins] = useState<number>(100);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('fun');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load data when user changes
  useEffect(() => {
    if (user) {
      const savedFun = localStorage.getItem(`funCoins_${user.id}`);
      const savedReal = localStorage.getItem(`realCoins_${user.id}`);
      const savedTx = localStorage.getItem(`transactions_${user.id}`);
      
      setFunCoins(savedFun ? Number(savedFun) : 1000);
      setRealCoins(savedReal ? Number(savedReal) : 100);
      setTransactions(savedTx ? JSON.parse(savedTx) : []);
    } else {
      // Default for guest/logged out
      setFunCoins(1000);
      setRealCoins(100);
      setTransactions([]);
    }
  }, [user]);

  // Save balances
  useEffect(() => {
    if (user) {
      localStorage.setItem(`funCoins_${user.id}`, String(funCoins));
      localStorage.setItem(`realCoins_${user.id}`, String(realCoins));
    }
  }, [funCoins, realCoins, user]);

  // Save transactions
  useEffect(() => {
    if (user) {
      localStorage.setItem(`transactions_${user.id}`, JSON.stringify(transactions));
    }
  }, [transactions, user]);


  const activeBalance = currencyMode === 'fun' ? funCoins : realCoins;
  const updateActiveBalance = currencyMode === 'fun' ? setFunCoins : setRealCoins;

  const logTransaction = (type: 'credit' | 'debit', amount: number, reason: string) => {
    const newTx: Transaction = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        amount,
        currency: currencyMode,
        reason,
        timestamp: Date.now()
    };
    setTransactions(prev => [newTx, ...prev].slice(0, 100)); // Keep last 100 transactions
  };

  const addCoins = (amount: number, reason: string = 'Game Win') => {
    updateActiveBalance(prev => prev + amount);
    logTransaction('credit', amount, reason);
  };

  const subtractCoins = (amount: number, reason: string = 'Game Bet') => {
    if (activeBalance >= amount) {
      updateActiveBalance(prev => prev - amount);
      logTransaction('debit', amount, reason);
      return true;
    }
    return false;
  };

  const resetCoins = () => {
      setFunCoins(1000);
      setRealCoins(100);
      setTransactions([]);
  }

  const canBet = (amount: number) => {
    return activeBalance >= amount && amount > 0;
  };

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
      transactions
    }}>
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
