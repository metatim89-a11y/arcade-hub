
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

  const [showPassword, setShowPassword] = useState(false);

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
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 pr-10 text-white focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
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
