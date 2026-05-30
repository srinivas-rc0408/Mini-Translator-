import { Language } from "../services/geminiService";

export interface User {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: number;
  name?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface VerificationCode {
  email: string;
  code: string;
  expiresAt: number;
  type: 'signup' | 'reset';
}
