import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GlassButton, GlassFilter } from './ui/liquid-glass';
import InteractiveNeuralVortex from './ui/interactive-neural-vortex-background';
import { User, Mail, LogOut, ArrowLeft, Camera, ShieldCheck, Loader2 } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout, updateProfile, isLoading, error } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ name });
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      // Error handled by context
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <InteractiveNeuralVortex>
      <GlassFilter />
      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl bg-white/10 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative">
          {/* Header/Back Button */}
          <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5">
            <button 
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-white tracking-tight">Account Profile</h1>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all font-semibold text-sm border border-red-500/20"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Profile Avatar Section */}
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl ring-4 ring-white/10 group-hover:ring-white/20 transition-all">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <button className="absolute bottom-1 right-1 p-3 rounded-full bg-white text-black shadow-lg hover:scale-110 active:scale-95 transition-all">
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              {/* User Info Section */}
              <div className="flex-1 space-y-6 w-full">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white/40">Full Name</label>
                    {!isEditing && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Edit Name
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <form onSubmit={handleUpdate} className="flex gap-2">
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        autoFocus
                      />
                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setName(user.name || '');
                        }}
                        className="px-4 py-2 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <User className="w-5 h-5 text-white/40" />
                      <span className="text-lg font-semibold text-white">{user.name || 'Anonymous User'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-white/40 mb-2 block">Email Address</label>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-white/40" />
                      <span className="text-white/80">{user.email}</span>
                    </div>
                    {user.isVerified && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm text-center font-bold">
                {successMessage}
              </div>
            )}

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-white/5 rounded-[30px] border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                <h3 className="text-white font-bold mb-1">Security Settings</h3>
                <p className="text-white/40 text-xs">Update password and 2FA</p>
              </div>
              <div className="p-6 bg-white/5 rounded-[30px] border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                <h3 className="text-white font-bold mb-1">Privacy</h3>
                <p className="text-white/40 text-xs">Manage your data visibility</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InteractiveNeuralVortex>
  );
};
