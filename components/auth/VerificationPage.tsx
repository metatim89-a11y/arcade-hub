
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import GlassButton from '../ui/GlassButton';

interface VerificationPageProps {
  email: string;
}

const VerificationPage: React.FC<VerificationPageProps> = ({ email }) => {
  const { verifyEmail, cancelVerification } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  useEffect(() => {
      // Debug helper to find the code in local storage for display
      const users = JSON.parse(localStorage.getItem('arcade_users') || '[]');
      const found = users.find((u: any) => u.email === email);
      if (found && found.verificationCode) {
          setDebugCode(found.verificationCode);
      }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const isValid = await verifyEmail(email, code);
      if (!isValid) {
        setError('Invalid verification code. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (success) {
     return (
         <div className="flex flex-col items-center justify-center min-h-[50vh]">
             <div className="bg-green-500/20 border border-green-500/50 p-8 rounded-2xl text-center animate-pop-in">
                 <div className="text-6xl mb-4">✅</div>
                 <h2 className="text-3xl font-bold text-white mb-2">Verified!</h2>
                 <p className="text-green-200">Redirecting you to the arcade floor...</p>
             </div>
         </div>
     )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
      <div className="bg-gray-900/80 border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-sm relative">
        {/* Back Button */}
        <button
            onClick={cancelVerification}
            className="absolute top-4 left-4 text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-sm font-bold"
        >
            ← Back
        </button>

        <h2 className="text-2xl font-bold text-yellow-400 mb-2 text-center mt-4">Verify Email</h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          We sent a code to <span className="text-white font-semibold">{email}</span>.
        </p>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1 text-center">6-Digit Code</label>
            <input 
              type="text" 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-yellow-400 transition-colors font-mono"
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>

          <GlassButton type="submit" className="mt-2 w-full py-3 !bg-green-600 hover:!bg-green-500">
            VERIFY ACCOUNT
          </GlassButton>
        </form>

        {/* Debug Code Display */}
        {debugCode && (
            <div className="mt-6 p-3 bg-gray-800 rounded-lg border border-gray-700 text-center animate-slide-in">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Development Mode</div>
                <div className="text-gray-400 text-sm">Your verification code is:</div>
                <div className="text-xl font-mono text-yellow-400 font-bold tracking-widest mt-1">{debugCode}</div>
            </div>
        )}
      </div>
    </div>
  );
};

export default VerificationPage;
