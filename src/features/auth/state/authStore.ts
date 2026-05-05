import { create } from 'zustand';
import { authRepository } from '../data/authRepository';
import type { UserSession } from '../model/types';

type AuthState = {
  session: UserSession | null;
  isLoading: boolean;
  error: string | null;
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: false,
  error: null,

  restoreSession: async () => {
    set({ isLoading: true });
    // Set up the listener for Firebase auth state
    authRepository.onSessionChange((session) => {
      set({ session, isLoading: false });
    });
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      if (!email || !password) {
        throw new Error('Please fill in all fields');
      }
      const session = await authRepository.login(email, password);
      set({ session, isLoading: false });
    } catch (e) {
      set({ 
        error: e instanceof Error ? e.message : 'Login failed', 
        isLoading: false 
      });
    }
  },

  register: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      if (!email || !password || !displayName) {
        throw new Error('Please fill in all fields');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      
      const session = await authRepository.register(email, password, displayName);
      set({ session, isLoading: false });
    } catch (e) {
      set({ 
        error: e instanceof Error ? e.message : 'Registration failed', 
        isLoading: false 
      });
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ isLoading: true, error: null });
    try {
      const session = await authRepository.loginWithGoogle(idToken);
      set({ session, isLoading: false });
    } catch (e) {
      set({ 
        error: e instanceof Error ? e.message : 'Google Sign-In failed', 
        isLoading: false 
      });
    }
  },

  resetPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await authRepository.sendPasswordReset(email);
      set({ isLoading: false });
    } catch (e) {
      set({ 
        error: e instanceof Error ? e.message : 'Reset failed', 
        isLoading: false 
      });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authRepository.clearSession();
      set({ session: null, isLoading: false });
    } catch (e) {
      set({ 
        error: 'Logout failed', 
        isLoading: false 
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));