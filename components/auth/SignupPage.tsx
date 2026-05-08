
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from '../ui/GlassButton';

interface SignupPageProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: (email: string) => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSwitchToLogin, onSignupSuccess }) => {
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
    }

    try {
      await signup(username, email, password);
      onSignupSuccess(email);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
      <div className="bg-gray-900/80 border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm">
        <h2 className="text-3xl font-bold text-yellow-400 mb-2 text-center">Join the Arcade</h2>
        <p className="text-gray-400 text-center mb-6 text-sm">Create your profile to track high scores and coins.</p>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors"
              placeholder="ArcadeKing"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors"
              placeholder="player@arcade.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <GlassButton type="submit" className="mt-2 w-full py-3 !bg-blue-600 hover:!bg-blue-500">
            SIGN UP
          </GlassButton>
        </form>

        <div className="mt-6 text-center text-gray-400 text-sm">
          Already have a profile?{' '}
          <button onClick={onSwitchToLogin} className="text-yellow-400 hover:underline font-bold">
            Login Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
