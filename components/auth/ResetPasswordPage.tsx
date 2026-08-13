import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from '../ui/GlassButton';

interface ResetPasswordPageProps {
  onComplete: () => void;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onComplete }) => {
  const { completePasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Your new password must contain at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await completePasswordRecovery(password);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Unable to update your password. Please request a new reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await cancelPasswordRecovery();
    onComplete();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
      <div className="bg-gray-900/80 border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm">
        <h2 className="text-3xl font-bold text-yellow-400 mb-3 text-center">Choose a New Password</h2>
        <p className="text-gray-400 text-sm text-center mb-6">Your reset link is verified. Choose a new password for your account.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center">{error}</div>}
          <div>
            <label htmlFor="new-password" className="block text-gray-400 text-sm mb-1">New password</label>
            <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors" autoComplete="new-password" required />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-gray-400 text-sm mb-1">Confirm new password</label>
            <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-400 transition-colors" autoComplete="new-password" required />
          </div>
          <GlassButton type="submit" disabled={isSubmitting} className="mt-2 w-full py-3 !bg-yellow-500 hover:!bg-yellow-400 text-gray-900 disabled:opacity-60">
            {isSubmitting ? 'UPDATING…' : 'UPDATE PASSWORD'}
          </GlassButton>
        </form>
        <div className="mt-6 text-center text-gray-400 text-sm"><button onClick={() => void handleCancel()} className="text-yellow-400 hover:underline font-bold">Cancel</button></div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
