import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types/auth';
import { AuthService } from '../services/authService';
import { supabase } from '../lib/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: { name?: string; avatarUrl?: string }) => Promise<void>;
  logout: () => void;
  loginOffline: (guestEmail?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Initial user fetch
    const initAuth = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        setState(prev => ({ ...prev, user, isLoading: false }));
      } catch (error) {
        console.warn("Initial Auth Check Failed, using offline check:", error);
        
        // Fallback to local session if fetch fails
        try {
          const localSession = localStorage.getItem("minitranslator_local_session");
          if (localSession) {
            const parsedUser = JSON.parse(localSession);
            setState({ user: parsedUser, isLoading: false, error: null });
            return;
          }
        } catch (e) {
          console.warn("Failed to parse local session:", e);
        }

        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: null // Do not block loading with a database error
        }));
      }
    };

    initAuth();

    // Listen for auth state changes safely
    let subscription: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setState({
            user: {
              id: session.user.id,
              email: session.user.email!,
              isVerified: true,
              createdAt: new Date(session.user.created_at).getTime(),
              name: session.user.user_metadata?.full_name,
              avatarUrl: session.user.user_metadata?.avatar_url,
            },
            isLoading: false,
            error: null,
          });
        } else {
          // Check if there is an active local session before clearing user
          const localSession = localStorage.getItem("minitranslator_local_session");
          if (!localSession) {
            setState({ user: null, isLoading: false, error: null });
          }
        }
      });
      subscription = data?.subscription;
    } catch (e) {
      console.warn("Supabase auth state listener subscription failed:", e);
    }

    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (e) {
          console.warn("Error unsubscribing auth state listener:", e);
        }
      }
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await AuthService.login(email, password);
      setState({ user, isLoading: false, error: null });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: (error as Error).message }));
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await AuthService.signup(email, password);
      setState(prev => ({ ...prev, isLoading: false, error: null }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: (error as Error).message }));
      throw error;
    }
  };

  const verifyOTP = async (email: string, code: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await AuthService.verifyOTP(email, code);
      setState({ user, isLoading: false, error: null });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: (error as Error).message }));
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await AuthService.forgotPassword(email);
      setState(prev => ({ ...prev, isLoading: false, error: null }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: (error as Error).message }));
      throw error;
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await AuthService.resetPassword(email, code, newPassword);
      setState(prev => ({ ...prev, isLoading: false, error: null }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: (error as Error).message }));
      throw error;
    }
  };

  const updateProfile = async (updates: { name?: string; avatarUrl?: string }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      if (state.user?.id.startsWith("local-")) {
        const updated = {
          ...state.user,
          name: updates.name || state.user.name,
          avatarUrl: updates.avatarUrl || state.user.avatarUrl,
        };
        localStorage.setItem("minitranslator_local_session", JSON.stringify(updated));
        setState(prev => ({ ...prev, user: updated, isLoading: false, error: null }));
        return;
      }
      await AuthService.updateProfile(updates);
      const user = await AuthService.getCurrentUser();
      setState(prev => ({ ...prev, user, isLoading: false, error: null }));
    } catch (error) {
      if (state.user) {
        // If it was a hybrid session and updateProfile fails, treat as local
        const updated = {
          ...state.user,
          name: updates.name || state.user.name,
          avatarUrl: updates.avatarUrl || state.user.avatarUrl,
        };
        localStorage.setItem("minitranslator_local_session", JSON.stringify(updated));
        setState(prev => ({ ...prev, user: updated, isLoading: false, error: null }));
        return;
      }
      setState(prev => ({ ...prev, isLoading: false, error: (error as Error).message }));
      throw error;
    }
  };

  const loginOffline = (guestEmail?: string) => {
    const email = guestEmail || "guest@minitranslator.local";
    const user = {
      id: "local-" + email.replace(/[^a-zA-Z0-9]/g, ""),
      email: email,
      isVerified: true,
      createdAt: Date.now(),
      name: email === "guest@minitranslator.local" ? "Guest Translator" : email.split('@')[0],
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`
    };
    localStorage.setItem("minitranslator_local_session", JSON.stringify(user));
    setState({ user, isLoading: false, error: null });
  };

  const logout = async () => {
    localStorage.removeItem("minitranslator_local_session");
    try {
      await AuthService.logout();
    } catch (error) {
      console.warn("Supabase signout failed during logout, but local session cleared.", error);
    }
    setState({ user: null, isLoading: false, error: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, verifyOTP, forgotPassword, resetPassword, updateProfile, logout, loginOffline }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
