
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
  isProfileActive?: boolean;
  isShopActive?: boolean;
}

const Header: React.FC<HeaderProps> = ({ mode, setMode, simple = false, onProfileClick, onHomeClick, onShopClick, isProfileActive, isShopActive }) => {
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
      <div className="w-full rounded-lg border border-amber-300/35 bg-black/35 px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-amber-100 md:text-[10px]">
          🚧 Site building in progress · Arcade Hub does not pay out real money · All coins and RC are virtual with no cash value · Monthly cash-prize tournaments will be announced with separate official rules and eligibility requirements
      </div>
  );

  const buttonClasses = "text-sm md:text-base border-none py-2 px-4 rounded-lg bg-gray-800 text-yellow-400 cursor-pointer shadow-md transition-colors duration-200";
  const activeButtonClasses = "bg-yellow-400 text-gray-800";

  if (simple) {
      return (
        <header className="relative flex flex-col justify-center items-center gap-4 p-6 bg-gradient-to-r from-[#a87c4f] to-[#7e3c3c] shadow-lg border-b-2 border-yellow-400/20 w-full">
            {versionButton}
            <h1 className="text-3xl md:text-4xl tracking-wider text-yellow-400 [text-shadow:0_2px_8px_rgba(182,137,45,0.26),0_0_2px_#fff] font-bold">
            🎲 Game Arcade Hub
            </h1>
            {disclaimer}
            {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
        </header>
      );
  }

  return (
    <header className="relative flex flex-col gap-2.5 p-3 pt-6 md:px-5 md:py-4 md:pt-6 bg-gradient-to-r from-[#a87c4f] to-[#7e3c3c] shadow-lg border-b-2 border-yellow-400/20 w-full">
      {versionButton}
      
      {/* Top Row: Title and User Controls */}
      <div className="flex flex-wrap justify-between items-center w-full gap-2.5">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={onHomeClick}>
            <h1 className="text-xl md:text-2xl tracking-wider text-yellow-400 [text-shadow:0_2px_8px_rgba(182,137,45,0.26),0_0_2px_#fff] font-bold">
            🎲 Game Arcade Hub
            </h1>
            <span className="hidden md:inline-block text-sm bg-black/20 text-white rounded-full px-3 py-1">
            {isCasinoMode ? 'Casino Mode (18+)' : 'Under 18 Mode'}
            </span>
        </div>

        {user && (
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleProfileClick}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${isProfileActive ? 'bg-yellow-400 text-black' : 'bg-black/30 text-white hover:bg-black/40'}`}
                >
                    <img src={user.avatar} alt="avatar" className="h-8 w-8 rounded-full border-2 object-cover" style={{ borderColor: profileFrame.color, boxShadow: `0 0 10px ${profileFrame.glow}` }} />
                    <span className="font-semibold hidden sm:inline">{user.username}</span>
                </button>
                {user.isAdmin && (
                    <button
                        type="button"
                        onClick={() => setShowAdmin(true)}
                        className="rounded-lg border border-sky-300/50 bg-sky-950/60 px-3 py-2 text-xs font-bold text-sky-100 hover:bg-sky-900/70"
                    >
                        Admin
                    </button>
                )}
                {!user.isGuest && (
                    <button type="button" onClick={onShopClick} className={`rounded-lg border px-3 py-2 text-xs font-black transition ${isShopActive ? 'border-fuchsia-200 bg-fuchsia-500 text-white' : 'border-fuchsia-300/40 bg-fuchsia-950/60 text-fuchsia-100 hover:bg-fuchsia-900/70'}`}>
                        ✨ Shop
                    </button>
                )}
                <button 
                    onClick={logout}
                    className="text-xs text-red-200 hover:text-red-100 hover:underline"
                >
                    Logout
                </button>
            </div>
        )}
      </div>

      {/* Bottom Row: Coins and Mode Switch (Only if not in profile view) */}
      {!isProfileActive && !isShopActive && (
        <div className="flex flex-wrap justify-between items-center gap-4 w-full border-t border-white/10 pt-2">
            <div className="flex items-center gap-4">
                {!user?.isGuest && (
                    <button type="button" onClick={handleProfileClick} className="flex gap-2 text-xs font-black">
                        <span className="rounded-xl border border-purple-300/25 bg-purple-950/60 px-3 py-1.5 text-purple-200">LV {progression.level}</span>
                        <span className="rounded-xl border border-cyan-300/25 bg-cyan-950/60 px-3 py-1.5 text-cyan-200">🎟 {tickets.toLocaleString()}</span>
                    </button>
                )}
                {isCasinoMode && (
                <div className="flex items-center gap-2">
                    <div className="flex gap-2 text-sm md:text-base font-bold">
                        <div className={`py-1 px-3 rounded-xl shadow-inner shadow-black/50 transition-colors ${currencyMode === 'fun' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-900/70 text-yellow-400/60'}`}>
                        Fun: <span>{Math.floor(funCoins)}</span>
                        </div>
                        <div className={`py-1 px-3 rounded-xl shadow-inner shadow-black/50 transition-colors ${currencyMode === 'real' ? 'bg-green-500 text-gray-900' : 'bg-gray-900/70 text-green-400/60'}`}>
                        Virtual RC: <span>{Math.floor(realCoins)}</span>
                        </div>
                    </div>
                </div>
                )}

                {/* Reset Coins for Guest */}
                {user?.isGuest && (
                    <button
                        onClick={resetCoins}
                        className="text-xs bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-1 rounded border border-red-700/50 transition-colors shadow-sm"
                        title="Reset coin balance to default"
                    >
                        Reset Coins
                    </button>
                )}
            </div>

            <div className="flex gap-2 ml-auto">
                <button
                    onClick={() => setMode(GameMode.Under18)}
                    className={`${buttonClasses} ${!isCasinoMode ? activeButtonClasses : ''} py-1 px-3 text-xs`}
                >
                    Under 18
                </button>
                <button
                    onClick={() => setMode(GameMode.Adult)}
                    className={`${buttonClasses} ${isCasinoMode ? activeButtonClasses : ''} py-1 px-3 text-xs`}
                >
                    Casino (18+)
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
