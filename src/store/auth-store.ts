import { create } from 'zustand';

export type UserRole = 'sales_rep' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  territory?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start loading until session check completes

  login: (user: AuthUser) => set({ user, isAuthenticated: true, isLoading: false }),

  logout: async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {
      // Ignore errors on logout
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkSession: async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const user = await res.json();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
