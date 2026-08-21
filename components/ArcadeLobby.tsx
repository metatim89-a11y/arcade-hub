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

type LeaderboardRow = {
  display_name: string;
  play_count: number;
  coins_spent: number;
};

type LandingComment = {
  id: number;
  display_name: string;
  body: string;
  created_at: string;
};

const GAME_META: Record<string, { icon: string; tag: string; blurb: string }> = {
  fishing: { icon: '🌊', tag: 'Ocean Action', blurb: 'Hunt targets, chain combos, face bosses and push deeper into the ocean.' },
  coinpusher: { icon: '🪙', tag: 'Physics Arcade', blurb: 'Drop coins, build pressure and trigger satisfying cascades off the edge.' },
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
  const { progression, claimLevelFaucet, tickets, funCoins, realCoins } = useCoinSystem();
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
    const remainingMs = new Date(progression.nextFaucetAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      setFaucetReady(true);
      setFaucetLabel(`CLAIM ${progression.faucetAmount.toLocaleString()} FREE GC`);
      return;
    }
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setFaucetReady(false);
    setFaucetLabel(`Free GC in ${minutes}:${String(seconds).padStart(2, '0')}`);
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

  const handleClaim = async () => {
    if (!faucetReady) return;
    await claimLevelFaucet();
  };

  const economyCards = useMemo(() => [
    ['GC', 'Free play currency', 'GC is given away through the faucet and play systems. You do not need to buy GC to enjoy Arcade Hub.'],
    ['Tickets', 'Competitive rewards', 'Tickets are earned through eligible head-to-head and real-player competition and can be used in the shop or traded toward XP.'],
    ['XP + Levels', 'Long-term progression', 'Trade eligible GC and tickets for XP to raise your level, improve progression rewards and build your arcade profile.'],
    ['RC', 'Virtual arcade credits', 'RC is a virtual entertainment balance. Ticket-shop systems can award RC, but RC is not cash and currently cannot be withdrawn.'],
  ], []);

  return (
    <section className="w-full max-w-7xl px-4 py-6 text-slate-100" aria-label={isAdult ? '18 plus arcade landing page' : 'arcade landing page'}>
      <div className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-2xl md:p-10 ${isAdult ? 'border-amber-400/25 bg-gradient-to-br from-[#241406] via-[#120d0a] to-[#071017]' : 'border-cyan-400/25 bg-gradient-to-br from-[#071c26] via-[#0b1020] to-[#170b29]'}`}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.28em] text-amber-300">{isAdult ? '18+ entertainment arcade' : 'Free-play social arcade'}</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-6xl">Play for fun. Build your level. Compete with people.</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">Arcade Hub is a browser arcade built around games, friendly competition and progression. There is no requirement to spend money here. Free GC is provided through the arcade, and optional purchases or support go toward continued development, hosting, server costs, art, sound and improving the site.</p>
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold leading-6 text-emerald-100">No cash withdrawals are available right now. GC, RC, tickets, XP, cosmetics and shop rewards are virtual entertainment items inside Arcade Hub.</div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => featured && onPlay(featured)} className="rounded-xl bg-gradient-to-b from-amber-300 to-orange-500 px-7 py-3 font-black text-slate-950 shadow-lg transition hover:brightness-110 active:scale-95">PLAY {featured?.label?.toUpperCase()}</button>
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-300"><strong className="block text-white">Current wallet</strong>{Math.floor(funCoins).toLocaleString()} GC · 🎟 {tickets.toLocaleString()} · {Math.floor(realCoins).toLocaleString()} RC</div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/35 p-6 text-center shadow-inner">
            <div className="text-7xl" aria-hidden="true">{featuredMeta.icon}</div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[.25em] text-amber-300">Featured · {featuredMeta.tag}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{featured?.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{featuredMeta.blurb}</p>
          </div>
        </div>
      </div>

      {user && !user.isGuest && (
        <div className={`mx-auto my-8 transition-all duration-500 ${faucetReady ? 'max-w-4xl' : 'max-w-xl'}`}>
          <button type="button" disabled={!faucetReady} onClick={() => void handleClaim()} className={`w-full rounded-3xl border font-black uppercase tracking-wide transition-all duration-500 ${faucetReady ? 'min-h-36 border-emerald-200 bg-gradient-to-r from-emerald-300 via-lime-300 to-yellow-300 px-8 py-7 text-2xl text-slate-950 shadow-[0_0_30px_rgba(52,211,153,.65),0_0_70px_rgba(163,230,53,.35)] hover:scale-[1.015] hover:brightness-110 active:scale-95 md:text-4xl animate-pulse' : 'min-h-14 border-slate-700 bg-slate-900/80 px-5 py-3 text-sm text-slate-400 shadow-none cursor-not-allowed'}`}>
            <span className="block">{faucetReady ? '🪙 FREE GC FAUCET READY' : 'GC FAUCET COOLDOWN'}</span>
            <span className={`${faucetReady ? 'mt-2 block text-base md:text-xl' : 'ml-2 inline text-xs'} normal-case tracking-normal`}>{faucetLabel}</span>
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">The faucet grows with your progression level. Claiming it costs nothing.</p>
        </div>
      )}

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {economyCards.map(([title, subtitle, copy]) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-lg">
            <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{title}</p>
            <h3 className="mt-1 text-lg font-black text-white">{subtitle}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
          </article>
        ))}
      </div>

      <div className="mb-10 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-950/35 to-cyan-950/35 p-6">
        <h2 className="text-2xl font-black text-white">How the Shop works</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">The Shop contains cosmetics, styles and small optional support packages. Ticket-priced items use tickets earned inside the arcade. Optional paid support is never required to keep playing; it helps pay for development and operating costs. Cosmetics are for appearance and entertainment, not cash value.</p>
      </div>

      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-amber-300">Choose your game</p><h2 className="text-3xl font-black text-white">Arcade lineup</h2></div>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-slate-400">{games.length} games</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {games.map((game) => {
          const meta = GAME_META[game.id] ?? fallbackMeta;
          return (
            <button key={game.id} type="button" onClick={() => onPlay(game)} className="group min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-left shadow-xl transition hover:-translate-y-1 hover:border-amber-300/40 hover:shadow-[0_18px_35px_rgba(0,0,0,.5)] active:translate-y-0">
              <div className="flex items-start justify-between"><span className="text-5xl transition group-hover:scale-110" aria-hidden="true">{meta.icon}</span><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">{meta.tag}</span></div>
              <h3 className="mt-7 text-xl font-black text-white group-hover:text-amber-200">{game.label}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{meta.blurb}</p>
              <span className="mt-6 inline-block text-xs font-black uppercase tracking-wider text-cyan-300">Play now →</span>
            </button>
          );
        })}
      </div>

      <div className="mt-12 rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">One board for every game</p><h2 className="text-3xl font-black text-white">Game leaderboards</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Current rankings use recorded play activity and GC participation. Game-specific scores and win/loss rankings can replace this as each game reports authoritative results.</p></div>
          <select value={leaderboardGameId} onChange={(event) => setLeaderboardGameId(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold text-white outline-none focus:border-cyan-400">
            {games.map((game) => <option key={game.id} value={game.id}>{game.label}</option>)}
          </select>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-[48px_1fr_90px_100px] bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500"><span>#</span><span>Player</span><span>Plays</span><span>GC played</span></div>
          {user?.isGuest ? <p className="p-6 text-center text-sm text-slate-400">Create or sign into an account to view recorded leaderboards.</p> : leaderboardLoading ? <p className="p-6 text-center text-sm text-slate-400">Loading leaderboard…</p> : leaderboardError ? <p className="p-6 text-center text-sm text-red-300">{leaderboardError}</p> : leaderboard.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">No recorded players for this game yet. Be the first.</p> : leaderboard.map((row, index) => (
            <div key={`${row.display_name}-${index}`} className="grid grid-cols-[48px_1fr_90px_100px] items-center border-t border-white/5 px-4 py-3 text-sm"><strong className={index < 3 ? 'text-amber-300' : 'text-slate-500'}>{index + 1}</strong><span className="truncate font-bold text-white">{row.display_name}</span><span className="text-cyan-200">{row.play_count.toLocaleString()}</span><span className="text-emerald-200">{Math.floor(row.coins_spent).toLocaleString()}</span></div>
          ))}
        </div>
      </div>

      <div className="mt-10 rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-5 md:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-cyan-300">Community wall</p><h2 className="text-3xl font-black text-white">{isAdult ? '18+ Arcade comments' : 'Arcade comments'}</h2><p className="mt-2 text-sm text-slate-400">Tell us what works, what breaks, and what game you want improved next.</p></div>
          <button type="button" onClick={() => void loadComments()} disabled={commentLoading} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-300 hover:bg-white/10 disabled:opacity-50">Refresh</button>
        </div>

        {!user || user.isGuest ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">Sign in with a player account to leave a comment. You can still read the board.</div>
        ) : (
          <div className="mt-5">
            <textarea value={commentText} onChange={(event) => setCommentText(event.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="Leave feedback for the arcade…" className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400" />
            <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{commentText.length}/500 · 15 second anti-spam cooldown</span><button type="button" onClick={() => void handlePostComment()} disabled={commentLoading || !commentText.trim()} className="rounded-xl bg-cyan-300 px-5 py-2 text-xs font-black uppercase tracking-wider text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Post comment</button></div>
          </div>
        )}

        {commentError && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{commentError}</p>}
        <div className="mt-5 space-y-3">
          {commentLoading && comments.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">Loading comments…</p> : comments.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No comments yet. Be the first to leave feedback.</p> : comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-4"><div><strong className="text-sm text-white">{comment.display_name}</strong><span className="ml-2 text-[11px] text-slate-600">{comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}</span></div>{user?.isAdmin && <button type="button" onClick={() => void handleDeleteComment(comment.id)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/20">Delete</button>}</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{comment.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-10 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6 text-center">
        <h2 className="text-2xl font-black text-amber-100">A fun arcade first</h2>
        <p className="mx-auto mt-3 max-w-4xl text-sm leading-6 text-slate-300">Play free, collect GC, compete where multiplayer is available, earn tickets, build XP and levels, customize games through the Shop, and come back as the arcade grows. Spending money is optional support—not a requirement to participate or progress.</p>
        <p className="mt-4 text-xs font-black uppercase tracking-wider text-red-200">No cash withdrawals are currently offered.</p>
      </div>
    </section>
  );
};

export default ArcadeLobby;