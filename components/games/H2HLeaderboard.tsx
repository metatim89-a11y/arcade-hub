import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../lib/supabase';
import GlassButton from '../ui/GlassButton';

interface H2HLeaderboardProps {
  onBack: () => void;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar: string;
  elo_rating: number;
  total_matches: number;
  wins: number;
  win_percentage: number;
  total_gc_won: number;
}

const H2HLeaderboard: React.FC<H2HLeaderboardProps> = ({ onBack }) => {
  const { user } = useAuth();
  const supabase = getSupabase();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'global' | 'personal'>('global');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setError(null);
        const { data, error: fetchError } = await supabase.rpc('get_h2h_leaderboard', {
          p_limit: 100,
        });

        if (fetchError) throw fetchError;
        setLeaderboard(data || []);

        // Fetch personal stats if authenticated
        if (user?.id) {
          const { data: statsData, error: statsError } = await supabase.rpc('get_h2h_player_stats', {
            p_user_id: user.id,
          });
          if (statsError) throw statsError;
          if (statsData && statsData.length > 0) {
            setPlayerStats(statsData[0]);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [user?.id, supabase]);

  return (
    <div className="w-full max-w-5xl px-4 py-6 text-white select-none">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/80 via-slate-900/90 to-indigo-950/80 p-6 sm:p-8 border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)] mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-black tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            COMPETITIVE RANKINGS
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            🏆 H2H LEADERBOARD
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-semibold leading-relaxed">
            Compete globally! Climb the ranks through head-to-head matches and earn ELO rating.
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

      {/* Tab Selection */}
      <div className="mb-8 flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setSelectedTab('global')}
          className={`px-6 py-3 font-black text-sm uppercase tracking-wider transition-all ${
            selectedTab === 'global'
              ? 'text-purple-300 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          🌍 Global Rankings
        </button>
        <button
          onClick={() => setSelectedTab('personal')}
          className={`px-6 py-3 font-black text-sm uppercase tracking-wider transition-all ${
            selectedTab === 'personal'
              ? 'text-purple-300 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          👤 Your Stats
        </button>
      </div>

      {/* Global Leaderboard Tab */}
      {selectedTab === 'global' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-slate-400 font-semibold">Loading leaderboard...</p>
              </div>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-4xl mb-3 block">🎮</span>
              <p className="text-slate-300 font-semibold">No matches yet!</p>
              <p className="text-xs text-slate-400 mt-1">Play head-to-head matches to appear on the leaderboard.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => {
                const isCurrentUser = entry.user_id === user?.id;
                return (
                  <div
                    key={entry.user_id}
                    className={`p-4 rounded-2xl flex items-center justify-between gap-4 transition-all border ${
                      isCurrentUser
                        ? 'bg-purple-950/40 border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-center min-w-12">
                        <span className="text-2xl font-black text-yellow-300">
                          {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                        </span>
                      </div>

                      <img
                        src={entry.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&q=80'}
                        alt={entry.username}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                      />

                      <div className="flex-1">
                        <h3 className={`font-black text-sm ${isCurrentUser ? 'text-purple-300' : 'text-white'}`}>
                          {entry.username}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold">
                          {entry.wins}W - {entry.total_matches - entry.wins}L ({entry.win_percentage?.toFixed(1)}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">ELO</p>
                        <p className="text-xl font-black text-yellow-300">{entry.elo_rating.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">EARNED</p>
                        <p className="text-sm font-black text-emerald-400">+{Math.floor(entry.total_gc_won)} GC</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Personal Stats Tab */}
      {selectedTab === 'personal' && (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-slate-400 font-semibold">Loading your stats...</p>
              </div>
            </div>
          ) : !playerStats ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-4xl mb-3 block">👤</span>
              <p className="text-slate-300 font-semibold">No matches played yet!</p>
              <p className="text-xs text-slate-400 mt-1">Play your first head-to-head match to see your stats.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-purple-400/30">
                  <p className="text-xs text-purple-300 uppercase tracking-widest font-black mb-2">YOUR ELO RATING</p>
                  <p className="text-5xl font-black text-yellow-300">{playerStats.elo_rating?.toFixed(0)}</p>
                  <p className="text-xs text-slate-400 mt-2">Global Rank: #{playerStats.rank}</p>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-400/30">
                  <p className="text-xs text-emerald-300 uppercase tracking-widest font-black mb-2">TOTAL GC EARNED</p>
                  <p className="text-5xl font-black text-emerald-400">{Math.floor(playerStats.total_gc_won)}</p>
                  <p className="text-xs text-slate-400 mt-2">Staked: {Math.floor(playerStats.total_gc_staked)} GC</p>
                </div>
              </div>

              {/* Win Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">MATCHES</p>
                  <p className="text-3xl font-black text-white">{playerStats.total_matches}</p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-center">
                  <p className="text-xs text-emerald-300 uppercase tracking-widest font-bold mb-1">WINS</p>
                  <p className="text-3xl font-black text-emerald-400">{playerStats.wins}</p>
                </div>

                <div className="p-4 rounded-xl bg-red-950/40 border border-red-600/40 text-center">
                  <p className="text-xs text-red-300 uppercase tracking-widest font-bold mb-1">LOSSES</p>
                  <p className="text-3xl font-black text-red-400">{playerStats.losses}</p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">WIN PERCENTAGE</p>
                  <p className="text-2xl font-black text-cyan-400">
                    {playerStats.win_percentage?.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">WIN STREAK</p>
                  <p className="text-2xl font-black text-orange-400">
                    {playerStats.win_streak}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default H2HLeaderboard;
