import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';

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
