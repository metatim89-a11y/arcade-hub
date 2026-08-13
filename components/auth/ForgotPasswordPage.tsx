import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from '../ui/GlassButton';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin }) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Unable to send the reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
      <div className="bg-gray-900/80 border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm">
        <h2 className="text-3xl font-bold text-yellow-400 mb-3 text-center">Reset Password</h2>
        <p className="text-gray-400 text-sm text-center mb-6">Enter your account email and we’ll send you a secure reset link.</p>

        {sent ? (
          <div className="text-center">
            <div className="bg-green-500/20 border border-green-500/50 text-green-100 p-4 rounded-lg text-sm mb-6">
              If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.
            </div>
            <GlassButton onClick={onBackToLogin} className="w-full py-3 !bg-yellow-500 hover:!bg-yellow-400 text-gray-900">
              BACK TO LOGIN
            </GlassButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center">{error}</div>}
            <div>
              <label htmlFor="reset-email" className="block text-gray-400 text-sm mb-1">Email</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors"
                placeholder="player@example.com"
                autoComplete="email"
                required
              />
            </div>
            <GlassButton type="submit" disabled={isSubmitting} className="mt-2 w-full py-3 !bg-yellow-500 hover:!bg-yellow-400 text-gray-900 disabled:opacity-60">
              {isSubmitting ? 'SENDING…' : 'SEND RESET LINK'}
            </GlassButton>
          </form>
        )}

        {!sent && <div className="mt-6 text-center text-gray-400 text-sm"><button onClick={onBackToLogin} className="text-yellow-400 hover:underline font-bold">Back to Login</button></div>}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
