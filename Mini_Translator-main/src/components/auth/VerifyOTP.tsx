import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, Loader2, ArrowRight, RefreshCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';

export const VerifyOTP: React.FC = () => {
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(60);
  const { verifyOTP, forgotPassword, isLoading, error, loginOffline } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const from = location.state?.from || 'signup';

  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [email, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (from === 'signup') {
        await verifyOTP(email, otp);
        navigate('/');
      } else {
        // For reset, verifyOTP just checks validity. 
        // In this mock service, verifyOTP returns the user or throws.
        // We'll pass the OTP to ResetPassword page instead of calling verify here 
        // to simplify the flow and follow standard patterns.
        navigate('/reset-password', { state: { email, otp } });
      }
    } catch (err) {
      // Error handled by context
    }
  };

  const handleResend = async () => {
    try {
      // We use forgotPassword as a general "send OTP" if user exists
      await forgotPassword(email);
      setTimer(60);
    } catch (err) {
      // Handle error
    }
  };

  return (
    <AuthLayout title="Verify OTP" subtitle={`We've sent a 6-digit code to ${email}.`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div className="bg-red-500/10 text-red-400 text-xs p-3 rounded-xl border border-red-500/20 mb-2 flex flex-col gap-2">
            <p>{error}</p>
            {(String(error).includes("fetch") || String(error).includes("connection") || String(error).includes("network") || String(error).includes("servers")) && (
              <button
                type="button"
                onClick={() => {
                  loginOffline(email);
                  navigate("/");
                }}
                className="mt-1 w-full bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-[10px] py-1 text-white rounded-lg font-semibold"
              >
                🚀 Skip & Continue as Offline Guest
              </button>
            )}
          </div>
        )}
        
        <div className="relative">
          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder="Enter 6-digit code"
            required
            maxLength={6}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center text-lg tracking-widest font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-white/20"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 border border-white/10"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Verify Code
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/5" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-[#0b0f19] px-2 text-white/30 font-bold tracking-widest">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            loginOffline(email);
            navigate("/");
          }}
          className="w-full bg-white/5 hover:bg-white/10 text-white/80 py-3 rounded-xl font-bold text-sm border border-white/10 transition-all cursor-pointer text-center"
        >
          Skip & Continue Offline
        </button>

        <div className="text-center">
          {timer > 0 ? (
            <p className="text-xs text-white/40">
              Resend code in <span className="font-bold text-indigo-400">{timer}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-xs font-bold text-indigo-400 hover:text-white hover:underline flex items-center justify-center gap-1.5 mx-auto"
            >
              <RefreshCcw className="w-3 h-3" />
              Resend OTP code
            </button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
};
