import { User } from "../types/auth";
import { supabase, isSupabaseAvailable } from "../lib/supabase";

export class AuthService {
  static async signup(email: string, password: string): Promise<string> {
    if (!isSupabaseAvailable()) {
      throw new Error("Unable to connect to the signup servers (Failed to fetch). Feel free to click 'Continue Offline' to instantly access the app in Guest Mode!");
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        const isFetchError = String(error?.message || error || "").toLowerCase().includes("failed to fetch");
        if (isFetchError) {
          console.warn("Supabase Signup connection issue (Failed to fetch).");
        } else {
          console.warn("Supabase Signup Error Details:", JSON.stringify(error, null, 2));
        }
        throw error;
      }
      if (!data.user) throw new Error("Signup failed");

      return email;
    } catch (error: any) {
      const errMsg = String(error?.message || error || "").toLowerCase();
      if (errMsg.includes("failed to fetch") || errMsg.includes("network") || errMsg.includes("retryable") || error.status === 0) {
        throw new Error("Unable to connect to the signup servers (Failed to fetch). Feel free to click 'Continue Offline' to instantly access the app in Guest Mode!");
      }
      throw error;
    }
  }

  static async verifyOTP(email: string, token: string): Promise<User> {
    if (!isSupabaseAvailable()) {
      throw new Error("Bypassed: Supabase connection unavailable.");
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error) throw error;
    if (!data.user) throw new Error("Verification failed");

    return {
      id: data.user.id,
      email: data.user.email!,
      isVerified: true,
      createdAt: new Date(data.user.created_at).getTime(),
      name: data.user.user_metadata?.full_name,
      avatarUrl: data.user.user_metadata?.avatar_url,
    };
  }

  static async login(email: string, password: string): Promise<User> {
    if (!isSupabaseAvailable()) {
      throw new Error("Unable to connect to the login servers (Failed to fetch). Feel free to click 'Continue Offline' below to instantly use Guest Mode!");
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const isFetchError = String(error?.message || error || "").toLowerCase().includes("failed to fetch");
        if (isFetchError) {
          console.warn("Supabase Login connection issue (Failed to fetch).");
        } else {
          console.warn("Supabase Login Error Details:", JSON.stringify(error, null, 2));
        }
        throw error;
      }
      if (!data.user) throw new Error("Login failed");

      return {
        id: data.user.id,
        email: data.user.email!,
        isVerified: true,
        createdAt: new Date(data.user.created_at).getTime(),
        name: data.user.user_metadata?.full_name,
        avatarUrl: data.user.user_metadata?.avatar_url,
      };
    } catch (error: any) {
      const errMsg = String(error?.message || error || "").toLowerCase();
      if (errMsg.includes("failed to fetch") || errMsg.includes("network") || errMsg.includes("retryable") || error.status === 0) {
        throw new Error("Unable to connect to the login servers (Failed to fetch). Feel free to click 'Continue Offline' below to instantly use Guest Mode!");
      }
      throw error;
    }
  }

  static async forgotPassword(email: string): Promise<void> {
    if (!isSupabaseAvailable()) {
      throw new Error("Bypassed: Supabase connection unavailable.");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  }

  static async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    if (!isSupabaseAvailable()) {
      throw new Error("Bypassed: Supabase connection unavailable.");
    }
    // For password reset via OTP, we first verify the OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (verifyError) throw verifyError;

    // Then update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) throw updateError;
  }

  static async logout() {
    if (!isSupabaseAvailable()) return;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Supabase auth.signOut failed, ignoring since we are cleaning local session anyway.", error);
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    if (isSupabaseAvailable()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          return {
            id: session.user.id,
            email: session.user.email!,
            isVerified: true,
            createdAt: new Date(session.user.created_at).getTime(),
            name: session.user.user_metadata?.full_name,
            avatarUrl: session.user.user_metadata?.avatar_url,
          };
        }
      } catch (e) {
        console.warn("Supabase getCurrentUser failed, attempting local fallback:", e);
      }
    }

    // Attempt local storage fallback
    try {
      const localSession = localStorage.getItem("minitranslator_local_session");
      if (localSession) {
        return JSON.parse(localSession);
      }
    } catch (e) {
      console.warn("Failed to parse local session:", e);
    }
    return null;
  }

  static async updateProfile(updates: { name?: string; avatarUrl?: string }): Promise<void> {
    if (!isSupabaseAvailable()) {
      throw new Error("Bypassed: Supabase connection unavailable.");
    }
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: updates.name,
          avatar_url: updates.avatarUrl,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.warn("Supabase updateProfile failed, utilizing fallback", error);
      throw error;
    }
  }
}
