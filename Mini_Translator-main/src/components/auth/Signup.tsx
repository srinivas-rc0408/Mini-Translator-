import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';

export const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  const { signup, isLoading, error, loginOffline } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      await signup(email, password);
      // After signup, redirect to OTP verification
      navigate('/verify-otp', { state: { email, from: 'signup' } });
    } catch (err) {
      loginOffline(email || "guest@minitranslator.local");
      navigate("/");
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Join our AI translation community today.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {(error || passwordError) && (
          <div className="bg-red-500/10 text-red-400 text-xs p-3 rounded-xl border border-red-500/20 mb-2 flex flex-col gap-2">
            <p>{typeof error === 'object' ? (error as any)?.message || JSON.stringify(error) : (error || passwordError)}</p>
            {error && (String(error).includes("fetch") || String(error).includes("connection") || String(error).includes("network") || String(error).includes("servers")) && (
              <button
                type="button"
                onClick={() => {
                  loginOffline(email || "guest@minitranslator.local");
                  navigate("/");
                }}
                className="mt-1 w-full bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/40 text-[10px] py-1 text-white rounded-lg font-semibold"
              >
                🚀 Bypass & Register and Login Locally
              </button>
            )}
          </div>
        )}
        
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="email"
            placeholder="Email address"
            required
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium placeholder:text-white/20"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium placeholder:text-white/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="relative" key="confirm-password">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="password"
            placeholder="Confirm Password"
            required
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium placeholder:text-white/20"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 border border-white/10 mt-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Sign Up
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
            loginOffline(email || "guest@minitranslator.local");
            navigate("/");
          }}
          className="w-full bg-white/5 hover:bg-white/10 text-white/80 py-3 rounded-xl font-bold text-sm border border-white/10 transition-all cursor-pointer text-center"
        >
          Continue Offline (Guest Mode)
        </button>

        <div className="text-center mt-4">
          <p className="text-xs text-white/40">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};
