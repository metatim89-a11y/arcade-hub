
import React from 'react';

export enum GameMode {
  Under18 = 'under18',
  Adult = 'adult',
}

export interface Game {
  id: string;
  label: string;
  component: React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>;
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
  isAdmin?: boolean;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: CurrencyMode;
  reason: string;
  timestamp: number;
}

export type AestheticVisualKey = 'neon' | 'gold' | 'galaxy' | 'ember' | 'frost';
export type AestheticRewardType = 'coins' | 'experience' | 'powerup';

export interface GameAesthetic {
  id: string;
  gameId: string;
  name: string;
  description: string;
  visualKey: AestheticVisualKey;
  ticketCost: number;
  requiredExperience: number;
  valueCents: number;
  rewardType: AestheticRewardType;
  rewardAmount: number;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  sortOrder: number;
}

export interface AestheticPurchaseReward {
  aestheticId: string;
  tickets: number;
  experience: number;
  level: number;
  powerups: number;
  rewardType: AestheticRewardType;
  rewardAmount: number;
}

export interface PlayerGameStat {
  gameId: string;
  playCount: number;
  coinsSpent: number;
}

export interface PlayerBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'game' | 'copper' | 'silver' | 'gold' | 'platinum';
}

export interface ProfileFrameReward {
  name: string;
  minimumLevel: number;
  color: string;
  glow: string;
  background: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
