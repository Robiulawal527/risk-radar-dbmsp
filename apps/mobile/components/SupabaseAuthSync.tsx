import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { UserRole, type User } from '@risk-radar/types';

type ProfileRow = {
  full_name?: string | null;
  phone?: string | null;
  avatar?: string | null;
  skills?: string[] | null;
  alert_latitude?: number | null;
  alert_longitude?: number | null;
  alerts_enabled?: boolean | null;
};

function mapSessionToUser(session: Session, existing?: User | null, profile?: ProfileRow | null) {
  const u = session.user;
  const metadata = u.user_metadata ?? {};
  const sameExisting = existing?.id === u.id ? existing : null;
  return {
    user: {
      id: u.id,
      email: u.email ?? '',
      name:
        profile?.full_name ||
        (metadata.name as string) ||
        sameExisting?.name ||
        u.email?.split('@')[0] ||
        'User',
      role: UserRole.USER,
      phone: profile?.phone ?? (metadata.phone as string | undefined) ?? sameExisting?.phone,
      avatar: profile?.avatar ?? (metadata.avatar as string | undefined) ?? sameExisting?.avatar,
      skills: profile?.skills ?? (Array.isArray(metadata.skills) ? (metadata.skills as string[]) : sameExisting?.skills),
      alertLatitude:
        profile?.alert_latitude ??
        (typeof metadata.alertLatitude === 'number' ? metadata.alertLatitude : sameExisting?.alertLatitude ?? null),
      alertLongitude:
        profile?.alert_longitude ??
        (typeof metadata.alertLongitude === 'number' ? metadata.alertLongitude : sameExisting?.alertLongitude ?? null),
      alertsEnabled:
        profile?.alerts_enabled ??
        (typeof metadata.alertsEnabled === 'boolean' ? metadata.alertsEnabled : sameExisting?.alertsEnabled ?? true),
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
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar, skills, alert_latitude, alert_longitude, alerts_enabled')
        .eq('id', session.user.id)
        .maybeSingle<ProfileRow>();
      const existing = useAuthStore.getState().user;
      const { user, accessToken, refreshToken } = mapSessionToUser(session, existing, data ?? null);
      await useAuthStore.getState().setAuth(user, accessToken, refreshToken);
    };

    const clearIfSignedOut = async () => {
      await useAuthStore.getState().clearAuth();
    };

    const reconcileSession = () => {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await applySession(data.session);
        } else {
          await clearIfSignedOut();
        }
      })();
    };

    if (useAuthStore.persist.hasHydrated()) {
      reconcileSession();
    } else {
      unsubHydration = useAuthStore.persist.onFinishHydration(reconcileSession);
    }

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
