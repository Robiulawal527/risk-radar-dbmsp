import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';

/** Returns true once Zustand persist has rehydrated from storage. */
export function useAuthHydration(): boolean {
  const [ready, setReady] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setReady(true));
    return unsub;
  }, []);

  return ready;
}

/**
 * Full "auth ready" signal for routing decisions.
 * Waits for BOTH:
 *  - Zustand persist hydration (fast cached user/isAuthenticated)
 *  - At least one live Supabase session reconciliation (getSession + profile enrichment + role)
 *
 * This eliminates the race where persisted "logged in" state causes a redirect to tabs,
 * followed by SupabaseAuthSync discovering an expired/invalid session and flipping to login.
 */
export function useAuthReady(): boolean {
  const hydrated = useAuthHydration();
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  return hydrated && sessionChecked;
}
