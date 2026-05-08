
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from '../ui/GlassButton';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToSignup }) => {
  const { login, loginAsGuest } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGuestLogin = async () => {
      try {
          await loginAsGuest();
      } catch (e) {
          setError("Failed to enter as guest");
      }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
      <div className="bg-gray-900/80 border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm">
        <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">Player Login</h2>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Username or Email</label>
            <input 
              type="text" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors"
              placeholder="Username or email"
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

          <GlassButton type="submit" className="mt-2 w-full py-3 !bg-yellow-500 hover:!bg-yellow-400 text-gray-900">
            ENTER ARCADE
          </GlassButton>
        </form>

        <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center">
                <span className="px-2 bg-[#151b24] text-sm text-gray-500">OR</span>
            </div>
        </div>

        <button 
            onClick={handleGuestLogin}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 hover:bg-gray-800/50 transition-all font-semibold"
        >
            Play as Guest
        </button>

        <div className="mt-6 text-center text-gray-400 text-sm">
          New Challenger?{' '}
          <button onClick={onSwitchToSignup} className="text-yellow-400 hover:underline font-bold">
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
