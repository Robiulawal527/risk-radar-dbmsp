import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@risk-radar/types';

function mapSessionToUser(session: Session) {
  const u = session.user;
  return {
    user: {
      id: u.id,
      email: u.email ?? '',
      name: (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'User',
      role: UserRole.USER,
      phone: u.user_metadata?.phone as string | undefined,
      avatar: u.user_metadata?.avatar as string | undefined,
      createdAt: new Date(u.created_at || Date.now()),
      updatedAt: new Date(),
    },
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? '',
  };
}

export function SupabaseAuthSync() {
  useEffect(() => {
    let unsubHydration: (() => void) | undefined;

    const applySession = async (session: Session) => {
      const { user, accessToken, refreshToken } = mapSessionToUser(session);
      await useAuthStore.getState().setAuth(user, accessToken, refreshToken);
    };

    const clearIfSignedOut = async () => {
      await useAuthStore.getState().clearAuth();
    };

    unsubHydration = useAuthStore.persist.onFinishHydration(() => {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await applySession(data.session);
        } else {
          await clearIfSignedOut();
        }
      })();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!useAuthStore.persist.hasHydrated()) {
        return;
      }

      if (event === 'SIGNED_OUT') {
        await clearIfSignedOut();
        return;
      }

      if (session?.user) {
        await applySession(session);
      }
    });

    return () => {
      unsubHydration?.();
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
