
import React from 'react';

export enum GameMode {
  Under18 = 'under18',
  Adult = 'adult',
}

export interface Game {
  id: string;
  label: string;
  component: React.ComponentType<any>; // Allow games to receive props
}

export type PlayMode = 'vsPlayer' | 'vsComputer';
export type CurrencyMode = 'fun' | 'real';

export interface User {
  id: string;
  username: string;
  email: string;
  isVerified: boolean;
  avatar?: string;
  bio?: string;
  joinedAt: string;
  isGuest?: boolean;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: CurrencyMode;
  reason: string;
  timestamp: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
