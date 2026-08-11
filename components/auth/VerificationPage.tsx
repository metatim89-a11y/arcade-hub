import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from '../ui/GlassButton';

const VerificationPage: React.FC<{ email: string }> = ({ email }) => {
  const { resendVerification, cancelVerification } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resend = async () => {
    setMessage('');
    setError('');
    try {
      await resendVerification(email);
      setMessage('A new confirmation email was sent.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to resend the confirmation email.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900/80 p-8 text-center shadow-2xl backdrop-blur-sm">
        <button onClick={cancelVerification} className="absolute left-4 top-4 text-sm font-bold text-gray-500 hover:text-white">← Back</button>
        <div className="mb-4 mt-3 text-5xl">✉️</div>
        <h2 className="mb-2 text-2xl font-bold text-yellow-400">Confirm your email</h2>
        <p className="mb-5 text-sm text-gray-400">
          Supabase sent a secure confirmation link to <span className="font-semibold text-white">{email}</span>.
          Open that link to finish creating your account.
        </p>
        {message && <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/20 p-3 text-sm text-green-200">{message}</div>}
        {error && <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/20 p-3 text-sm text-red-200">{error}</div>}
        <GlassButton onClick={resend} className="w-full py-3 !bg-green-600 hover:!bg-green-500">RESEND EMAIL</GlassButton>
      </div>
    </div>
  );
};

export default VerificationPage;
