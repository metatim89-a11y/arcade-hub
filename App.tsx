
import React, { useState } from 'react';
import { CoinProvider } from './context/CoinContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GameMode, Game } from './types';
import { ADULT_GAMES, UNDER18_GAMES } from './constants';
import Header from './components/Header';
import GameArea from './components/GameArea';
import Footer from './components/Footer';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import VerificationPage from './components/auth/VerificationPage';
import ProfilePage from './components/profile/ProfilePage';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, verificationPendingEmail } = useAuth();
  const [mode, setMode] = useState<GameMode>(GameMode.Under18);
  const [games] = useState(() => {
      // Initial games logic - effect below updates it
      return mode === GameMode.Adult ? ADULT_GAMES : UNDER18_GAMES;
  });
  const [selectedGame, setSelectedGame] = useState<Game>(games[0]);
  
  // View States for Auth/Profile
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [showProfile, setShowProfile] = useState(false);

  // Handle Game Mode switching
  const handleSetMode = (newMode: GameMode) => {
    if (mode !== newMode) {
      setMode(newMode);
      const newGames = newMode === GameMode.Adult ? ADULT_GAMES : UNDER18_GAMES;
      setSelectedGame(newGames[0]);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-yellow-400">Loading Arcade...</div>;
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
                    <LoginPage onSwitchToSignup={() => setAuthView('signup')} />
                ) : (
                    <SignupPage 
                        onSwitchToLogin={() => setAuthView('login')} 
                        onSignupSuccess={() => {/* Logic handled by verification state in context */}}
                    />
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
        onProfileClick={() => setShowProfile(true)} 
        onHomeClick={() => setShowProfile(false)}
        isProfileActive={showProfile}
      />
      <main className="flex-grow flex flex-col items-center w-full">
        {showProfile ? (
            <ProfilePage onBack={() => setShowProfile(false)} />
        ) : (
            <GameArea 
                games={activeGames} 
                selectedGame={activeGames.find(g => g.id === selectedGame.id) || activeGames[0]} 
                onSelectGame={setSelectedGame} 
                mode={mode}
            />
        )}
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
        <CoinProvider>
            <AppContent />
        </CoinProvider>
    </AuthProvider>
  );
}

export default App;
