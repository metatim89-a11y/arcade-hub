import React, { useEffect, useMemo, useState } from 'react';
import type { Game, GameMode } from '../types';
import { useCoinSystem } from '../context/CoinContext';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';

type ArcadeLobbyProps = {
  games: Game[];
  mode: GameMode;
  onPlay: (game: Game) => void;
};

// SVG badges for games
const gameBadges: Record<string, { tag: string; blurb: string; iconSvg: React.ReactNode }> = {
  fishing: {
    tag: 'DEEP OCEAN',
    blurb: 'Track trophy catches & deep sea targets',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 01-9-9c0-4.97 4.03-9 9-9s9 4.03 9 9a9 9 0 01-9 9zm0-15a6 6 0 100 12 6 6 0 000-12z" />
      </svg>
    )
  },
  slots: {
    tag: 'VOLT VAULT',
    blurb: 'Spin high yield multiplier reels',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    )
  },
  plinko: {
    tag: 'PEG MATRIX',
    blurb: 'Drop down high velocity multiplier pegs',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18m9-9H3m15.364 6.364l-12.728-12.728m12.728 0L6.364 18.364" />
      </svg>
    )
  },
  jetpilot: {
    tag: 'JET LANDER',
    blurb: 'Control jet thrusters & land on high multipliers',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    )
  },
  wheel: {
    tag: 'TITANIUM WHEEL',
    blurb: 'Pick precision sector stakes',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  nim: {
    tag: 'LOGIC NIM',
    blurb: 'Execute strategic pile elimination',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m-6 5h6m-6 5h6M6 7h.01M6 12h.01M6 17h.01" />
      </svg>
    )
  },
  chutes: {
    tag: 'TACTICAL RACE',
    blurb: 'Climb ladders and calculate slides',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16M4 12h16M4 19h16M8 5v14m8-14v14" />
      </svg>
    )
  },
  blockdrop: {
    tag: 'GRID STACK',
    blurb: 'Stack block formations and clear lines',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
      </svg>
    )
  },
  mancala: {
    tag: 'PIT TACTICS',
    blurb: 'Classic pebble distribution strategy',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4m16 0a8 8 0 11-16 0 8 8 0 0116 0z" />
      </svg>
    )
  },
  neonhopper: {
    tag: 'RETRO HOPPER',
    blurb: 'Dodge laser cars and navigate floating river logs',
    iconSvg: (
      <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  kongclimber: {
    tag: 'RETRO CLIMBER',
    blurb: 'Dodge rolling barrels and climb steel girders to victory',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v18M19 3v18M5 7h14M5 12h14M5 17h14" />
      </svg>
    )
  },
  whackattack: {
    tag: 'TARGET RUSH',
    blurb: 'Whack targets, dodge decoys and chase your best combo',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18m9-9H3m3.5-5.5 11 11m0-11-11 11" />
      </svg>
    )
  }
};

type LandingComment = {
  id: number;
  display_name: string;
  body: string;
  created_at: string;
};

const GAME_META: Record<string, { icon: string; tag: string; blurb: string }> = {
  fishing: { icon: '🌊', tag: 'Ocean Action', blurb: 'Hunt targets, chain combos, face bosses and push deeper into the ocean.' },
  whackattack: { icon: '🔨', tag: 'Target Rush', blurb: 'Whack targets, dodge red decoys and build a high-speed combo.' },
  crash: { icon: '🚀', tag: 'Timing', blurb: 'Ride the multiplier and decide when to cash out before the run ends.' },
  plinko: { icon: '🔻', tag: 'Drop Game', blurb: 'Choose your risk, release the ball and watch it bounce through the peg field.' },
  slots: { icon: '⚡', tag: 'Reels', blurb: 'Spin themed reels with bonuses, free spins, power meters and special features.' },
  neonhopper: { icon: '🟢', tag: 'Reflex', blurb: 'Dodge traffic, ride moving logs and climb the neon course one hop at a time.' },
  kongclimber: { icon: '🦍', tag: 'Platform', blurb: 'Climb girders, dodge barrels and reach the top without getting knocked back.' },
  blockdrop: { icon: '🧱', tag: 'Puzzle', blurb: 'Stack clean lines, use fast drops and keep the board alive as speed increases.' },
  mancala: { icon: '🟡', tag: 'Strategy', blurb: 'Plan captures, extra turns and long sequences in a classic head-to-head board game.' },
  chutes: { icon: '🪜', tag: 'Race', blurb: 'Race to the finish while ladders launch you forward and chutes send you back.' },
  connect4: { icon: '🔴', tag: 'Strategy', blurb: 'Build four in a row while blocking your opponent and planning several moves ahead.' },
  blackjack: { icon: '🂡', tag: 'Cards', blurb: 'Play a clean virtual blackjack table using entertainment-only arcade currency.' },
  poker: { icon: '♠️', tag: 'Cards', blurb: 'Take a seat at the Hold’em table and play against other people when tables are available.' },
  keno: { icon: '🎯', tag: 'Numbers', blurb: 'Pick numbers, set your entertainment wager and reveal the draw.' },
  wheel: { icon: '🎡', tag: 'Spin', blurb: 'Choose a sector and spin a fast arcade wheel with mixed outcomes.' },
};

const fallbackMeta = { icon: '🎮', tag: 'Arcade Original', blurb: 'A playable Arcade Hub original built for quick browser sessions.' };

const ArcadeLobby: React.FC<ArcadeLobbyProps> = ({ games, mode, onPlay }) => {
  const { progression, claimLevelFaucet } = useCoinSystem();
  const { user } = useAuth();
  const [faucetReady, setFaucetReady] = useState(false);
  const [faucetLabel, setFaucetLabel] = useState('Checking faucet…');
  const [leaderboardGameId, setLeaderboardGameId] = useState(games[0]?.id ?? '');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [comments, setComments] = useState<LandingComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState('');

  const isAdult = String(mode) === 'Adult';
  const commentMode = isAdult ? 'adult' : 'regular';
  const featured = games.find((game) => game.id === (isAdult ? 'fishing' : 'neonhopper')) ?? games[0];
  const featuredMeta = GAME_META[featured?.id] ?? fallbackMeta;

  const updateFaucetState = () => {
    if (!progression.nextFaucetAt) {
      setFaucetReady(true);
      setFaucetLabel(`CLAIM ${progression.faucetAmount.toLocaleString()} FREE GC`);
      return;
    }
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const nextTime = new Date(progression.nextFaucetAt!).getTime();
      if (now >= nextTime) {
        setFaucetReady(true);
        setFaucetLabel('CLAIM FREE GC NOW');
      } else {
        setFaucetReady(false);
        const diff = Math.floor((nextTime - now) / 1000);
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        setFaucetLabel(`COOLDOWN: ${m}m ${String(s).padStart(2, '0')}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [progression.nextFaucetAt]);

  const handleClaim = async () => {
    if (!faucetReady) return;
    const result = await claimLevelFaucet();
    if (result) {
      alert('Successfully claimed free GC!');
    }
  };

  useEffect(() => {
    updateFaucetState();
    const timer = window.setInterval(updateFaucetState, 1000);
    return () => window.clearInterval(timer);
  }, [progression.nextFaucetAt, progression.faucetAmount]);

  useEffect(() => {
    if (!games.some((game) => game.id === leaderboardGameId)) {
      setLeaderboardGameId(games[0]?.id ?? '');
    }
  }, [games, leaderboardGameId]);

  useEffect(() => {
    if (!leaderboardGameId || !user || user.isGuest) {
      setLeaderboard([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLeaderboardLoading(true);
      setLeaderboardError('');
      try {
        const { data, error } = await getSupabase().rpc('get_game_activity_leaderboard', { p_game_id: leaderboardGameId });
        if (error) throw error;
        if (!cancelled) {
          setLeaderboard((data ?? []).map((row: any) => ({
            display_name: String(row.display_name || 'Player'),
            play_count: Number(row.play_count || 0),
            coins_spent: Number(row.coins_spent || 0),
          })));
        }
      } catch (error: any) {
        if (!cancelled) {
          setLeaderboard([]);
          setLeaderboardError(error?.message || 'Leaderboard unavailable.');
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [leaderboardGameId, user?.id]);

  const loadComments = async () => {
    setCommentLoading(true);
    setCommentError('');
    try {
      const { data, error } = await getSupabase().rpc('get_landing_comments', { p_mode: commentMode });
      if (error) throw error;
      setComments((data ?? []).map((row: any) => ({
        id: Number(row.id),
        display_name: String(row.display_name || 'Player'),
        body: String(row.body || ''),
        created_at: String(row.created_at || ''),
      })));
    } catch (error: any) {
      setComments([]);
      setCommentError(error?.message || 'Comments are unavailable right now.');
    } finally {
      setCommentLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, [commentMode]);

  const handlePostComment = async () => {
    const body = commentText.trim();
    if (!user || user.isGuest || !body || body.length > 500) return;
    setCommentLoading(true);
    setCommentError('');
    try {
      const { error } = await getSupabase().rpc('post_landing_comment', { p_mode: commentMode, p_body: body });
      if (error) throw error;
      setCommentText('');
      await loadComments();
    } catch (error: any) {
      setCommentError(error?.message || 'Could not post that comment.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (!user?.isAdmin) return;
    setCommentError('');
    try {
      const { error } = await getSupabase().rpc('admin_delete_landing_comment', { p_comment_id: id });
      if (error) throw error;
      setComments((current) => current.filter((comment) => comment.id !== id));
    } catch (error: any) {
      setCommentError(error?.message || 'Could not remove that comment.');
    }
  };

  const economyCards = useMemo(() => [
    ['GC', 'Free play currency', 'GC is given away through the faucet and play systems. You do not need to buy GC to enjoy Arcade Hub.'],
    ['Tickets', 'Competitive rewards', 'Tickets are earned through eligible head-to-head and real-player competition and can be used in the shop or traded toward XP.'],
    ['XP + Levels', 'Long-term progression', 'Trade eligible GC and tickets for XP to raise your level, improve progression rewards and build your arcade profile.'],
    ['RC', 'Virtual arcade credits', 'RC is a virtual entertainment balance. Ticket-shop systems can award RC, but RC is not cash and currently cannot be withdrawn.'],
  ], []);

  const titleWord1 = ['A', 'R', 'C', 'A', 'D', 'E'];
  const titleWord2 = ['H', 'U', 'B'];

  return (
    <section className="w-full max-w-6xl px-4 py-4 text-slate-100 select-none" aria-label="Arcade Hub lobby">
      {/* Top Animated Banner Title (ARCADE HUB) floating on atmospheric dark background */}
      <div className="relative flex flex-col items-center justify-center pt-2 pb-6 text-center">
        {/* Subtle glowing ambient aura */}
        <div className="absolute -top-10 w-96 h-32 bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Claim GC Faucet Button (floating top-right) */}
        {user && !user.isGuest && (
          <div className="w-full flex justify-end mb-3 sm:mb-0 sm:absolute sm:top-2 sm:right-0 z-20">
            <button
              type="button"
              disabled={!faucetReady}
              onClick={handleClaim}
              className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all ${
                faucetReady
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 hover:brightness-110 active:scale-95 animate-pulse shadow-[0_0_20px_rgba(52,211,153,0.6)]'
                  : 'bg-slate-800 text-slate-400 opacity-70 cursor-not-allowed border border-slate-700'
              }`}
            >
              {faucetLabel}
            </button>
          </div>
        )}

        {/* Animated Letter Title: A R C A D E   H U B */}
        <h1 className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-4xl sm:text-6xl md:text-7xl font-black tracking-widest uppercase my-2 drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
          <span className="flex gap-1 sm:gap-2">
            {titleWord1.map((char, index) => (
              <span
                key={`w1-${char}-${index}`}
                className="inline-block text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.8)] animate-pulse"
                style={{ animationDelay: `${index * 120}ms`, animationDuration: '2.5s' }}
              >
                {char}
              </span>
            ))}
          </span>
          <span className="flex gap-1 sm:gap-2">
            {titleWord2.map((char, index) => (
              <span
                key={`w2-${char}-${index}`}
                className="inline-block text-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-pulse"
                style={{ animationDelay: `${(index + 6) * 120}ms`, animationDuration: '2.5s' }}
              >
                {char}
              </span>
            ))}
          </span>
        </h1>

        <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-200/90 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
          ✨ PREMIUM BROWSER ARCADE · RETRO & 3D GAMES ✨
        </p>
      </div>

      {/* Featured Hero Title Section - Unboxed floating layout directly on background */}
      <div className="relative my-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900/60 via-slate-900/40 to-slate-900/60 border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.1)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-widest uppercase shadow-[0_0_10px_rgba(245,158,11,0.3)]">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {art.tag} • FEATURED GAME
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)] uppercase">
            {featured.label}
          </h2>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {art.blurb}. Dive directly into action and set your record run!
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onPlay(featured)}
              className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)] hover:scale-105 active:scale-95 transition-all duration-200"
            >
              LAUNCH GAME NOW
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative w-32 h-32 sm:w-44 sm:h-44 rounded-3xl bg-slate-900/80 border-2 border-amber-400/40 flex items-center justify-center shadow-[0_0_35px_rgba(245,158,11,0.25)]">
          <div className="p-5 rounded-2xl bg-black/60 border border-amber-400/30">{art.iconSvg}</div>
        </div>
      </div>

      {/* Grid Heading */}
      <div className="flex items-center justify-between mt-8 mb-4 px-1">
        <div>
          <span className="text-xs font-black tracking-widest text-cyan-300 uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
            EXPLORE THE COLLECTION
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-yellow-300 uppercase mt-0.5 drop-shadow-[0_0_12px_rgba(253,224,71,0.4)]">
            Arcade Originals
          </h2>
        </div>
        <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-3.5 py-1.5 rounded-xl shadow-md">
          {games.length} GAMES
        </span>
      </div>

      {/* Game Cards Grid (Clean Floating Cards directly on background) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-8">
        {originals.map((game) => {
          const gameArt = gameBadges[game.id] ?? { tag: 'ORIGINAL', blurb: 'Arcade Hub title', iconSvg: null };
          return (
            <button
              type="button"
              key={game.id}
              className="group flex flex-col justify-between p-4 rounded-2xl text-left h-48 relative overflow-hidden bg-slate-900/80 border border-slate-700/80 hover:border-amber-400/80 hover:bg-slate-800/90 shadow-lg hover:shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all duration-200 hover:-translate-y-1"
              onClick={() => onPlay(game)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 rounded-xl bg-black/60 border border-amber-500/30 group-hover:border-amber-400 group-hover:bg-amber-500/20 transition-colors">
                  {gameArt.iconSvg}
                </div>
                <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest">{gameArt.tag}</span>
              </div>
              <div className="mt-auto space-y-1 z-10">
                <strong className="block text-base font-black text-white group-hover:text-amber-300 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {game.label}
                </strong>
                <p className="text-[11px] font-semibold text-slate-300 line-clamp-2 leading-snug">
                  {gameArt.blurb}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Daily Challenge Banner */}
      <div className="my-6 p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-amber-950/40 border border-amber-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <span className="text-xs font-black tracking-widest text-amber-300 uppercase">DAILY RUN CHALLENGE</span>
          <h3 className="text-xl font-black text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Set a new personal record today!
          </h3>
          <p className="text-xs font-semibold text-slate-300">
            Play a daily featured session to build your streak and earn virtual tickets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPlay(games[Math.min(2, games.length - 1)])}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
        >
          Start Daily Run →
        </button>
      </div>

      {/* Unboxed Floating Game Rules & About Info */}
      <div className="mt-10 pt-6 border-t border-amber-500/20 space-y-6">
        <div>
          <h3 className="text-3xl font-black text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.5)]">
            About Arcade Hub
          </h3>
          <p className="text-sm font-semibold text-slate-200 mt-2 leading-relaxed max-w-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Welcome to Arcade Hub! Collect GC (Gas Coins) to dive into head-to-head arcade action or redeem Tickets for
            exclusive cosmetics in the Shop. You can claim free GC from the faucet every 4.75 minutes!
          </p>
        </div>

        <div className="pt-2 space-y-4">
          <h4 className="text-xl font-bold text-cyan-300 uppercase tracking-widest border-b border-cyan-500/30 pb-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
            Rule Sets & Game Controls
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <strong className="text-amber-300 text-base">Neon Hopper</strong>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                Navigate using arrow keys/WASD or mobile controls across high-speed laser car highways and floating river logs.
              </p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300 text-base">Kong Climber (Donkey Kong)</strong>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                Run with ◀/▶, climb steel ladders with ▲/▼, and press 🦘 JUMP to leap over rolling barrels to reach the top princess!
              </p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300 text-base">Block Drop</strong>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                Brick stacking. Move left/right, soft drop, and press ↻ to rotate or ⚡ to instant drop. Clear full lines to score.
              </p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300 text-base">Mancala 3D</strong>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                Classic pit pebble distribution. Distribute stones counter-clockwise and land in your store for free extra turns.
              </p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300 text-base">Nim Game</strong>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                Pure logic. Take tokens from a single pile per turn. Whoever is forced to take the last token loses!
              </p>
            </div>
            <div className="space-y-1">
              <strong className="text-amber-300 text-base">Chutes & Ladders</strong>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed">
                Race to 100! Climb green ladders to jump ahead and avoid red chutes that slide you backward.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ArcadeLobby;