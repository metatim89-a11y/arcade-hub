import React from 'react';
import type { Game, GameMode } from '../types';

type ArcadeLobbyProps = {
  games: Game[];
  mode: GameMode;
  onPlay: (game: Game) => void;
};

// SVG badges for games (replacing emojis)
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
  crash: {
    tag: 'VELOCITY CURVE',
    blurb: 'Time your cash out before collision',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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
  rps: {
    tag: 'SHOWDOWN',
    blurb: 'Predict table sequences and counter moves',
    iconSvg: (
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
};

const ArcadeLobby: React.FC<ArcadeLobbyProps> = ({ games, mode, onPlay }) => {
  const featured = games.find((game) => game.id === (mode === 'Adult' ? 'fishing' : 'nim')) ?? games[0];
  const art = gameBadges[featured.id] ?? { tag: 'ORIGINAL', blurb: 'Featured Arcade Hub Title', iconSvg: null };
  const originals = games.slice(0, 6);

  return (
    <section className="w-full max-w-6xl px-4 py-6 text-slate-100" aria-label="Arcade Hub lobby">
      {/* Featured Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl onyx-glass-panel p-8 md:p-12 mb-8 border border-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_25px_60px_rgba(0,0,0,0.9)]">
        {/* Subtle Ambient Background Highlight */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-black tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {art.tag} FEATURED TITLE
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white uppercase">
              {featured.label}
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium">
              {art.blurb}. Enter the high-precision glass arena instantly and set your benchmark run.
            </p>
            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => onPlay(featured)}
                className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 font-black text-sm tracking-wider uppercase shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.45)] hover:scale-[1.02] active:scale-95 transition-all duration-200"
              >
                Launch Game
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative w-36 h-36 md:w-48 md:h-48 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900/80 to-black border border-amber-500/30 flex items-center justify-center shadow-[inset_0_0_30px_rgba(245,158,11,0.15),0_15px_35px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="p-6 rounded-xl bg-black/60 border border-amber-500/20 shadow-inner">
              {art.iconSvg}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Heading */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase">CURATED HUB ARCHITECTURE</span>
          <h2 className="text-2xl font-black tracking-tight text-amber-100 uppercase mt-0.5">Arcade Originals</h2>
        </div>
        <span className="text-xs font-bold text-amber-400/60 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
          {games.length} AVAILABLE
        </span>
      </div>

      {/* Game Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {originals.map((game) => {
          const gameArt = gameBadges[game.id] ?? { tag: 'ORIGINAL', blurb: 'Arcade Hub original', iconSvg: null };
          return (
            <button 
              type="button" 
              key={game.id} 
              className="onyx-glass-card group flex flex-col justify-between p-4 rounded-2xl text-left h-48 relative overflow-hidden"
              onClick={() => onPlay(game)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/20 group-hover:border-amber-400/40 group-hover:bg-amber-500/10 transition-colors">
                  {gameArt.iconSvg}
                </div>
                <span className="text-[9px] font-black text-amber-400/50 uppercase tracking-widest">{gameArt.tag}</span>
              </div>
              <div className="mt-auto space-y-1 z-10">
                <strong className="block text-base font-black text-white group-hover:text-amber-300 transition-colors">
                  {game.label}
                </strong>
                <p className="text-[10px] font-medium text-slate-400 line-clamp-2 leading-tight">
                  {gameArt.blurb}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Daily Challenge Banner */}
      <div className="relative overflow-hidden rounded-2xl onyx-glass-panel p-6 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase">DAILY RUN CHALLENGE</span>
          <h2 className="text-xl font-black text-white uppercase">Set a new personal record today.</h2>
          <p className="text-xs text-slate-400">Play a daily featured session to build your streak and earn virtual tickets.</p>
        </div>
        <button 
          type="button" 
          onClick={() => onPlay(games[Math.min(2, games.length - 1)])}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
        >
          Start Daily Run →
        </button>
      </div>
    </section>
  );
};

export default ArcadeLobby;
