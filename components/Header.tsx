
import React, { useState } from 'react';
import { GameMode } from '../types';
import { useCoinSystem } from '../context/CoinContext';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../constants';
import AdminPanel from './admin/AdminPanel';
import { profileFrameForLevel } from '../lib/profileRewards';

interface HeaderProps {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  simple?: boolean; // For login/signup pages
  onProfileClick?: () => void;
  onHomeClick?: () => void;
  onShopClick?: () => void;
  onSupportClick?: () => void;
  isProfileActive?: boolean;
  isShopActive?: boolean;
  isSupportActive?: boolean;
}

const Header: React.FC<HeaderProps> = ({ mode, setMode, simple = false, onProfileClick, onHomeClick, onShopClick, onSupportClick, isProfileActive, isShopActive, isSupportActive }) => {
  const { funCoins, realCoins, tickets, progression, currencyMode, resetCoins } = useCoinSystem();
  const { user, logout } = useAuth();
  const isCasinoMode = mode === GameMode.Adult;
  const [showAdmin, setShowAdmin] = useState(false);
  const profileFrame = profileFrameForLevel(progression.level);

  const handleProfileClick = () => {
      onProfileClick?.();
  };

  const versionButton = (
      <span className="absolute top-2 right-3 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white/45" title={`Arcade Hub version ${APP_VERSION}`}>
          v{APP_VERSION}
      </span>
  );
  const disclaimer = (
      <>
        <details className="mobile-legal-notice w-full rounded-lg border border-amber-300/35 bg-black/35 px-3 py-2 text-[10px] text-amber-100 md:hidden">
          <summary className="cursor-pointer text-center font-black uppercase tracking-wide">Virtual play & tournament notice</summary>
          <p className="mt-2 text-center font-semibold leading-relaxed">Arcade Hub does not pay out real money. Coins and RC are virtual with no cash value. Cash-prize tournaments use separate official rules and eligibility requirements.</p>
        </details>
        <div className="hidden w-full rounded-lg border border-amber-300/35 bg-black/35 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-amber-100 md:block">
            🚧 Site building in progress · Arcade Hub does not pay out real money · All coins and RC are virtual with no cash value · Monthly cash-prize tournaments will be announced with separate official rules and eligibility requirements
        </div>
      </>
  );

  const buttonClasses = "text-xs md:text-sm border border-amber-500/20 py-1.5 px-3.5 rounded-xl bg-black/40 text-amber-300 font-semibold cursor-pointer transition-all duration-200 hover:border-amber-400/50 hover:bg-black/60 shadow-inner";
  const activeButtonClasses = "bg-gradient-to-b from-amber-500 to-amber-600 text-slate-950 font-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)]";

  if (simple) {
      return (
        <header className="relative flex flex-col justify-center items-center gap-4 p-6 onyx-glass-panel w-full border-b border-black/80">
            {versionButton}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-md">
                AH
              </div>
              <h1 className="text-2xl md:text-3xl tracking-widest text-amber-300 font-black uppercase">
                Arcade Hub
              </h1>
            </div>
            <button type="button" onClick={onSupportClick} className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/60 transition">Support Project</button>
            {disclaimer}
            {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
        </header>
      );
  }

  return (
    <header className="relative flex flex-col gap-3 p-3 pt-5 md:px-6 md:py-4 md:pt-6 onyx-glass-panel w-full border-b border-black/90">
      {versionButton}
      
      {/* Top Row: Title and User Controls */}
      <div className="flex flex-wrap justify-between items-center w-full gap-3">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onHomeClick}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-[0_0_12px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-transform">
              AH
            </div>
            <h1 className="text-lg md:text-xl tracking-wider text-amber-200 font-extrabold uppercase group-hover:text-amber-100 transition-colors">
              Arcade Hub
            </h1>
            <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg px-2.5 py-0.5">
            {isCasinoMode ? 'Casino 18+' : 'Standard Arcade'}
            </span>
        </div>

        {user && (
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleProfileClick}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isProfileActive ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-black/50 text-amber-100 border-amber-500/20 hover:border-amber-400/40 hover:bg-black/70'}`}
                >
                    <img src={user.avatar} alt="avatar" className="h-7 w-7 rounded-lg border object-cover" style={{ borderColor: profileFrame.color, boxShadow: `0 0 8px ${profileFrame.glow}` }} />
                    <span className="font-bold text-xs hidden sm:inline">{user.username}</span>
                </button>
                {user.isAdmin && (
                    <button
                        type="button"
                        onClick={() => setShowAdmin(true)}
                        className="rounded-xl border border-amber-500/40 bg-amber-950/50 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-900/60"
                    >
                        Admin
                    </button>
                )}
                {!user.isGuest && (
                    <button type="button" onClick={onShopClick} className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${isShopActive ? 'border-amber-300 bg-amber-400 text-slate-950 font-black' : 'border-amber-500/30 bg-black/40 text-amber-200 hover:bg-amber-950/40'}`}>
                        Shop
                    </button>
                )}
                <button 
                    onClick={logout}
                    className="text-xs text-amber-400/60 hover:text-amber-300 hover:underline px-1"
                >
                    Logout
                </button>
            </div>
        )}
        <button type="button" onClick={onSupportClick} className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${isSupportActive ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-amber-500/30 bg-black/40 text-amber-200 hover:bg-amber-950/40'}`}>Support</button>
      </div>

      {/* Bottom Row: Coins and Mode Switch (Only if not in profile view) */}
      {!isProfileActive && !isShopActive && (
        <div className="flex flex-wrap justify-between items-center gap-3 w-full border-t border-amber-500/15 pt-2.5">
            <div className="flex items-center gap-3">
                {!user?.isGuest && (
                    <button type="button" onClick={handleProfileClick} className="flex gap-2 text-xs font-bold">
                        <span className="rounded-lg border border-amber-500/25 bg-black/60 px-2.5 py-1 text-amber-300">LV {progression.level}</span>
                        <span className="rounded-lg border border-amber-500/25 bg-black/60 px-2.5 py-1 text-amber-200">TK {tickets.toLocaleString()}</span>
                    </button>
                )}
                {isCasinoMode && (
                <div className="flex items-center gap-2">
                    <div className="flex gap-2 text-xs md:text-sm font-bold">
                        <div className={`py-1 px-3 rounded-lg border shadow-inner transition-all ${currencyMode === 'fun' ? 'bg-amber-500/20 text-amber-200 border-amber-500/40' : 'bg-black/50 text-amber-400/50 border-black/80'}`}>
                        FC: <span className="font-black text-amber-300">{Math.floor(funCoins)}</span>
                        </div>
                        <div className={`py-1 px-3 rounded-lg border shadow-inner transition-all ${currencyMode === 'real' ? 'bg-amber-500/20 text-amber-200 border-amber-500/40' : 'bg-black/50 text-amber-400/50 border-black/80'}`}>
                        VRC: <span className="font-black text-amber-300">{Math.floor(realCoins)}</span>
                        </div>
                    </div>
                </div>
                )}

                {/* Reset Coins for Guest */}
                {user?.isGuest && (
                    <button
                        onClick={resetCoins}
                        className="text-xs bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-colors shadow-sm"
                        title="Reset coin balance to default"
                    >
                        Reset Balance
                    </button>
                )}
            </div>

            <div className="flex gap-2 ml-auto">
                <button
                    onClick={() => setMode(GameMode.Under18)}
                    className={`${buttonClasses} ${!isCasinoMode ? activeButtonClasses : ''}`}
                >
                    Arcade
                </button>
                <button
                    onClick={() => setMode(GameMode.Adult)}
                    className={`${buttonClasses} ${isCasinoMode ? activeButtonClasses : ''}`}
                >
                    Casino 18+
                </button>
            </div>
        </div>
      )}
      {disclaimer}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </header>
  );
};

export default Header;
