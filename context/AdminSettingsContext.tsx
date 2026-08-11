import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export const GAME_RTP_DEFAULTS: Record<string, number> = {
  wheel: 100,
  crash: 100,
  blackjack: 100,
  poker: 100,
  keno: 100,
  plinko: 100,
  slots: 100,
  fishing: 100,
  coinpusher: 100,
  worm: 100,
  connect4: 100,
  rubikscube: 100,
  mancala: 100,
  rps: 100,
  tictactoe: 100
};

const STORAGE_KEY = 'arcade_admin_rtp_v1';

const readSettings = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
    return Object.fromEntries(Object.entries(GAME_RTP_DEFAULTS).map(([id, fallback]) => {
      const value = Number(saved[id]);
      return [id, Number.isFinite(value) ? Math.max(0, Math.min(200, value)) : fallback];
    }));
  } catch {
    return { ...GAME_RTP_DEFAULTS };
  }
};

interface AdminSettingsContextType {
  rtpByGame: Record<string, number>;
  setGameRtp: (gameId: string, value: number) => void;
  resetRtp: () => void;
  payoutMultiplierForReason: (reason: string) => number;
}

const AdminSettingsContext = createContext<AdminSettingsContextType | undefined>(undefined);

const gameIdFromReason = (reason: string): string | null => {
  const normalized = reason.toLowerCase();
  if (normalized.includes('refund') || normalized.includes('push')) return null;
  if (normalized.includes('coin pusher')) return 'coinpusher';
  if (normalized.includes('ocean hunter')) return 'fishing';
  if (normalized.includes('hold & spin') || normalized.includes('slots')) return 'slots';
  if (normalized.includes('plinko')) return 'plinko';
  if (normalized.includes('keno')) return 'keno';
  if (normalized.includes('wheel')) return 'wheel';
  if (normalized.includes('crash')) return 'crash';
  if (normalized.includes('blackjack') || normalized === 'dealer bust' || normalized === 'win') return 'blackjack';
  return null;
};

export const AdminSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rtpByGame, setRtpByGame] = useState<Record<string, number>>(readSettings);

  const persist = useCallback((next: Record<string, number>) => {
    setRtpByGame(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setGameRtp = useCallback((gameId: string, value: number) => {
    const cleanValue = Math.max(0, Math.min(200, Number.isFinite(value) ? value : 100));
    setRtpByGame((current) => {
      const next = { ...current, [gameId]: cleanValue };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetRtp = useCallback(() => persist({ ...GAME_RTP_DEFAULTS }), [persist]);

  const payoutMultiplierForReason = useCallback((reason: string) => {
    const gameId = gameIdFromReason(reason);
    return gameId ? (rtpByGame[gameId] ?? 100) / 100 : 1;
  }, [rtpByGame]);

  const value = useMemo(() => ({ rtpByGame, setGameRtp, resetRtp, payoutMultiplierForReason }), [payoutMultiplierForReason, resetRtp, rtpByGame, setGameRtp]);
  return <AdminSettingsContext.Provider value={value}>{children}</AdminSettingsContext.Provider>;
};

export const useAdminSettings = () => {
  const context = useContext(AdminSettingsContext);
  if (!context) throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  return context;
};
