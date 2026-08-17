import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

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
  nim: 100,
  chutes: 100,
  blockdrop: 100,
  connect4: 100,
  rubikscube: 100,
  mancala: 100,
  rps: 100,
  tictactoe: 100
};

const readSettings = () => {
  return { ...GAME_RTP_DEFAULTS };
};

interface AdminSettingsContextType {
  rtpByGame: Record<string, number>;
  setGameRtp: (gameId: string, value: number) => Promise<void>;
  setAllGameRtp: (value: number) => Promise<void>;
  resetRtp: () => Promise<void>;
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
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void getSupabase().from('game_rtp_settings').select('game_id, rtp').then(({ data, error }) => {
      if (!active || error || !data) return;
      persist({ ...GAME_RTP_DEFAULTS, ...Object.fromEntries(data.map((row) => [row.game_id, Number(row.rtp)])) });
    });
    const channel = getSupabase().channel('game-rtp-settings').on('postgres_changes', { event: '*', schema: 'public', table: 'game_rtp_settings' }, () => {
      void getSupabase().from('game_rtp_settings').select('game_id, rtp').then(({ data }) => {
        if (active && data) persist({ ...GAME_RTP_DEFAULTS, ...Object.fromEntries(data.map((row) => [row.game_id, Number(row.rtp)])) });
      });
    }).subscribe();
    return () => { active = false; void getSupabase().removeChannel(channel); };
  }, [persist]);

  const setGameRtp = useCallback(async (gameId: string, value: number) => {
    const cleanValue = Math.max(0, Math.min(200, Number.isFinite(value) ? value : 100));
    const { error } = await getSupabase().rpc('set_game_rtp', { p_game_id: gameId, p_rtp: cleanValue });
    if (error) throw error;
    setRtpByGame((current) => ({ ...current, [gameId]: cleanValue }));
  }, []);

  const setAllGameRtp = useCallback(async (value: number) => {
    const cleanValue = Math.max(0, Math.min(200, Number.isFinite(value) ? value : 100));
    const { error } = await getSupabase().rpc('set_all_game_rtp', { p_rtp: cleanValue });
    if (error) throw error;
    persist(Object.fromEntries(Object.keys(GAME_RTP_DEFAULTS).map((gameId) => [gameId, cleanValue])));
  }, [persist]);

  const resetRtp = useCallback(() => setAllGameRtp(100), [setAllGameRtp]);

  const payoutMultiplierForReason = useCallback((reason: string) => {
    const gameId = gameIdFromReason(reason);
    return gameId ? (rtpByGame[gameId] ?? 100) / 100 : 1;
  }, [rtpByGame]);

  const value = useMemo(() => ({ rtpByGame, setGameRtp, setAllGameRtp, resetRtp, payoutMultiplierForReason }), [payoutMultiplierForReason, resetRtp, rtpByGame, setAllGameRtp, setGameRtp]);
  return <AdminSettingsContext.Provider value={value}>{children}</AdminSettingsContext.Provider>;
};

export const useAdminSettings = () => {
  const context = useContext(AdminSettingsContext);
  if (!context) throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  return context;
};
