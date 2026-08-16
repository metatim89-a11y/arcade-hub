
// App.tsx v0.0.7 - Core Application Shell
import React, { useEffect, useState } from 'react';
import { CoinProvider } from './context/CoinContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCoinSystem } from './context/CoinContext';
import { GameMode, Game } from './types';
import { ADULT_GAMES, UNDER18_GAMES } from './constants';
import Header from './components/Header';
import GameArea from './components/GameArea';
import Footer from './components/Footer';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import VerificationPage from './components/auth/VerificationPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import ProfilePage from './components/profile/ProfilePage';
import AestheticShopPage from './components/shop/AestheticShopPage';
import GlobalChat from './components/ui/GlobalChat';
import ArcadeLobby from './components/ArcadeLobby';
import { AdminSettingsProvider } from './context/AdminSettingsContext';
import { recordSiteEvent } from './lib/analytics';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, verificationPendingEmail, isPasswordRecovery } = useAuth();
  const { notification, clearNotification } = useCoinSystem();
  const [mode, setMode] = useState<GameMode>(GameMode.Under18);
  const [games] = useState(() => {
      // Initial games logic - effect below updates it
      return mode === GameMode.Adult ? ADULT_GAMES : UNDER18_GAMES;
  });
  const [selectedGame, setSelectedGame] = useState<Game>(() => {
    const requested = new URLSearchParams(window.location.search).get('game');
    return games.find((game) => game.id === requested) ?? games[0];
  });
  const [showLobby, setShowLobby] = useState(() => !new URLSearchParams(window.location.search).has('game'));
  
  // View States for Auth/Profile
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showProfile, setShowProfile] = useState(false);
  const [showShop, setShowShop] = useState(false);

  useEffect(() => {
    void recordSiteEvent('page_view', undefined, user && !user.isGuest ? user.id : undefined);
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source') || params.get('ref');
    const storedSource = window.localStorage.getItem('arcade_campaign_source');
    if (source && source !== storedSource) {
      window.localStorage.setItem('arcade_campaign_source', source);
      void recordSiteEvent('referral_visit', undefined, user && !user.isGuest ? user.id : undefined, source);
    }
    const sessionKey = `arcade_session_${new Date().toISOString().slice(0, 10)}`;
    if (!window.sessionStorage.getItem(sessionKey)) {
      window.sessionStorage.setItem(sessionKey, '1');
      void recordSiteEvent('session_start', undefined, user && !user.isGuest ? user.id : undefined, storedSource || source || undefined);
    }
  }, [user?.id]);

  useEffect(() => {
    document.title = `${selectedGame.label} · Arcade Hub`;
  }, [selectedGame.label]);

  // Handle Game Mode switching
  const handleSetMode = (newMode: GameMode) => {
    if (mode !== newMode) {
      setMode(newMode);
      const newGames = newMode === GameMode.Adult ? ADULT_GAMES : UNDER18_GAMES;
      setSelectedGame(newGames[0]);
      setShowLobby(true);
      const url = new URL(window.location.href);
      url.searchParams.set('game', newGames[0].id);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const handleSelectGame = (game: Game) => {
    setSelectedGame(game);
    setShowLobby(false);
    const url = new URL(window.location.href);
    url.searchParams.set('game', game.id);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    void recordSiteEvent('game_opened', game.id, user && !user.isGuest ? user.id : undefined);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-yellow-400">Loading Arcade...</div>;
  }

  // Password recovery sessions are authenticated by Supabase temporarily, so this
  // must be evaluated before the normal authenticated application flow.
  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_25%,_#161b22_60%,_#232a35_100%)] text-gray-100 font-sans flex flex-col">
        <Header mode={mode} setMode={handleSetMode} simple />
        <main className="flex-grow flex flex-col items-center w-full pt-10">
          <ResetPasswordPage onComplete={() => setAuthView('login')} />
        </main>
        <Footer />
      </div>
    );
  }

  // 1. Verification Flow
  if (verificationPendingEmail && !isAuthenticated) {
      return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_50%_25%,_#161b22_60%,_#232a35_100%)] text-gray-100 font-sans flex flex-col">
            <Header mode={mode} setMode={handleSetMode} simple />
            <main className="flex-grow flex flex-col items-center w-full pt-10">
                <VerificationPage email={verificationPendingEmail} />
            </main>
            <Footer />
        </div>
      )
  }

  // 2. Unauthenticated Flow
  if (!isAuthenticated) {
    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_50%_25%,_#161b22_60%,_#232a35_100%)] text-gray-100 font-sans flex flex-col">
            <Header mode={mode} setMode={handleSetMode} simple />
            <main className="flex-grow flex flex-col items-center w-full pt-10">
                {authView === 'login' ? (
                    <LoginPage onSwitchToSignup={() => setAuthView('signup')} onForgotPassword={() => setAuthView('forgot')} />
                ) : authView === 'signup' ? (
                    <SignupPage 
                        onSwitchToLogin={() => setAuthView('login')} 
                        onSignupSuccess={() => {/* Logic handled by verification state in context */}}
                    />
                ) : (
                    <ForgotPasswordPage onBackToLogin={() => setAuthView('login')} />
                )}
            </main>
            <Footer />
        </div>
    );
  }

  // 3. Authenticated Flow
  const activeGames = mode === GameMode.Adult ? ADULT_GAMES : UNDER18_GAMES;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_25%,_#161b22_60%,_#232a35_100%)] text-gray-100 font-sans flex flex-col">
      <Header 
        mode={mode} 
        setMode={handleSetMode} 
        onProfileClick={() => { setShowProfile(true); setShowShop(false); setShowLobby(false); }}
        onShopClick={() => { setShowShop(true); setShowProfile(false); setShowLobby(false); }}
        onHomeClick={() => { setShowProfile(false); setShowShop(false); setShowLobby(true); }}
        isProfileActive={showProfile}
        isShopActive={showShop}
      />
      <main className="flex-grow flex flex-col items-center w-full">
        {notification && (
            <div className="fixed top-24 z-[100] bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl animate-bounce flex items-center gap-3">
                <span>⚠️ {notification}</span>
                <button onClick={clearNotification} className="bg-white/20 hover:bg-white/30 rounded-full w-6 h-6 flex items-center justify-center">✕</button>
            </div>
        )}
        {showProfile ? (
            <ProfilePage onBack={() => setShowProfile(false)} />
        ) : showShop ? (
            <AestheticShopPage onBack={() => setShowShop(false)} />
        ) : showLobby ? (
            <ArcadeLobby games={activeGames} mode={mode} onPlay={handleSelectGame} />
        ) : (
            <GameArea 
                games={activeGames} 
                selectedGame={activeGames.find(g => g.id === selectedGame.id) || activeGames[0]} 
                onSelectGame={handleSelectGame}
                mode={mode}
            />
        )}
      </main>
      <GlobalChat />
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
        <AdminSettingsProvider>
            <CoinProvider>
                <AppContent />
            </CoinProvider>
        </AdminSettingsProvider>
    </AuthProvider>
  );
}

export default App;
