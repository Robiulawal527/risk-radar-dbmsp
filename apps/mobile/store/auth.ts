import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@risk-radar/types';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // True once we have performed at least one live reconciliation against Supabase (getSession + profile).
  // Combined with zustand hydration, this gives a reliable "ready to decide authenticated UI" signal.
  sessionChecked: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  patchUser: (partial: Partial<User>) => void;
  patchTokens: (accessToken: string, refreshToken?: string) => void;
  clearAuth: () => Promise<void>;
  logout: () => void;
  setSessionChecked: (checked: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      sessionChecked: false,
      setAuth: async (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          sessionChecked: true,
        });
      },
      patchUser: (partial) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...partial } : null,
        })),
      patchTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
        }),
      clearAuth: async () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          sessionChecked: true, // we checked and it was invalid/empty
        });
      },
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          // do not flip sessionChecked here; logout is explicit user action
        }),
      setSessionChecked: (checked) => set({ sessionChecked: checked }),
    }),
    {
      name: 'risk-radar-mobile-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
        // Do NOT persist sessionChecked. Every app launch must perform a fresh live Supabase
        // reconciliation (getSession + profile) before we trust "isAuthenticated" and show the
        // main home/tabs. This prevents going directly to home based on stale persisted state
        // and ensures the "user must log in / sign up" gate (the choice page) is properly enforced
        // when the saved session is invalid/expired.
      }),
    }
  )
);
