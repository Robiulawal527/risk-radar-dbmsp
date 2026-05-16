import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/lib/types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  alertLatitude?: number | null;
  alertLongitude?: number | null;
  alertsEnabled?: boolean | null;
  skills?: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  patchUser: (partial: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setSession: (accessToken, user) =>
        set({
          accessToken,
          user,
          isAuthenticated: true,
        }),
      patchUser: (partial) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...partial } : null,
        })),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'risk-radar-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
