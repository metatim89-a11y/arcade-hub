import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../lib/supabase';

interface H2HMatchHistoryProps {
  onBack: () => void;
}

interface MatchRecord {
  id: string;
  match_id: string;
  opponent_id: string;
  opponent_username: string;
  game_label: string;
  result: 'WIN' | 'LOSS';
  player_score: number;
  opponent_score: number;
  stake_gc: number;
  reward_gc: number;
  elo_change: number;
  completed_at: string;
}

const H2HMatchHistory: React.FC<H2HMatchHistoryProps> = ({ onBack }) => {
  const { user } = useAuth();
  const supabase = getSupabase();

  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;
      
      try {
        setError(null);
        const { data, error: fetchError } = await supabase.rpc('get_h2h_player_history', {
          p_user_id: user.id,
          p_limit: 50,
        });

        if (fetchError) throw fetchError;
        setMatches(data || []);
      } catch (err: any) {
        console.error('Failed to fetch match history:', err);
        setError('Failed to load match history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user?.id, supabase]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-full max-w-5xl px-4 py-6 text-white select-none">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-blue-950/80 p-6 sm:p-8 border border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.2)] mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            MATCH RECORDS
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
            📊 MATCH HISTORY
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-semibold leading-relaxed">
            Review your head-to-head battles and track your progress.
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 rounded-2xl bg-slate-800/80 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-all text-center border border-slate-700"
        >
          ← BACK
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-950/80 border border-red-500/60 flex items-start gap-3 shadow-lg">
          <span className="text-xl mt-0.5">⚠️</span>
          <p className="text-sm font-semibold text-red-100">{error}</p>
        </div>
      )}

      {/* Match History List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-400 font-semibold">Loading match history...</p>
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-4xl mb-3 block">📭</span>
            <p className="text-slate-300 font-semibold">No matches recorded yet!</p>
            <p className="text-xs text-slate-400 mt-1">Play head-to-head matches to build your match history.</p>
          </div>
        ) : (
          matches.map((match) => {
            const isWin = match.result === 'WIN';
            const eloChangeColor = match.elo_change >= 0 ? 'text-emerald-400' : 'text-red-400';
            const eloChangeSign = match.elo_change >= 0 ? '+' : '';

            return (
              <div
                key={match.id}
                className={`p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all border ${
                  isWin
                    ? 'bg-emerald-950/30 border-emerald-600/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Match Info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${
                    isWin
                      ? 'bg-emerald-600/40 border border-emerald-500/60'
                      : 'bg-slate-800 border border-slate-700'
                  }`}>
                    {isWin ? '✓' : '✕'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-black uppercase tracking-widest ${
                        isWin ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {isWin ? 'VICTORY' : 'DEFEAT'}
                      </span>
                      <span className="text-xs text-slate-500">vs</span>
                      <span className="text-sm font-bold text-slate-300">{match.opponent_username}</span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1">{match.game_label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(match.completed_at)}</p>
                  </div>
                </div>

                {/* Score */}
                <div className="text-center px-4 py-2 bg-slate-900/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">SCORE</p>
                  <p className="font-black text-white">
                    <span className="text-cyan-300">{match.player_score}</span>
                    <span className="text-slate-500 mx-1">-</span>
                    <span className="text-orange-300">{match.opponent_score}</span>
                  </p>
                </div>

                {/* Stake & Reward */}
                <div className="text-center px-4 py-2 bg-slate-900/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">REWARD</p>
                  <div className="flex items-center gap-2">
                    <span className={`font-black ${isWin ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isWin ? '+' : '−'}{Math.abs(match.reward_gc)}
                    </span>
                    <span className="text-xs text-slate-500">GC</span>
                  </div>
                </div>

                {/* ELO Change */}
                <div className="text-center px-4 py-2 bg-slate-900/40 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">ELO</p>
                  <p className={`font-black text-lg ${eloChangeColor}`}>
                    {eloChangeSign}{match.elo_change?.toFixed(0)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default H2HMatchHistory;
