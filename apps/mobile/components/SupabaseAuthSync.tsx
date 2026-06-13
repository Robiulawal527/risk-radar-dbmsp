import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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

// In mobile we do not expose or support admin features/roles.
// Every user is treated as a regular USER. Admin functionality is web-only.
function mapSessionToUser(
  session: Session,
  existing?: User | null,
  profile?: ProfileRow | null
): { user: User; accessToken: string; refreshToken: string } {
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
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const hasDoneInitialReconcile = useRef(false);

  useEffect(() => {
    let unsubHydration: (() => void) | undefined;
    let appStateSub: any;

    const markChecked = () => {
      const store = useAuthStore.getState();
      if (!store.sessionChecked) store.setSessionChecked(true);
    };

    const applySession = async (session: Session) => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, phone, avatar, skills, alert_latitude, alert_longitude, alerts_enabled')
          .eq('id', session.user.id)
          .maybeSingle<ProfileRow>();

        const existing = useAuthStore.getState().user;
        const { user, accessToken, refreshToken } = mapSessionToUser(
          session,
          existing,
          profileData ?? null
        );

        await useAuthStore.getState().setAuth(user, accessToken, refreshToken);
      } catch (e) {
        // Still mark the session as "we tried" so UI can proceed (user may be partially populated from metadata)
        const existing = useAuthStore.getState().user;
        const minimalUser: User = {
          id: session.user.id,
          email: session.user.email || '',
          name:
            (session.user.user_metadata?.name as string) ||
            existing?.name ||
            session.user.email?.split('@')[0] ||
            'User',
          role: UserRole.USER,
          phone: (session.user.user_metadata?.phone as string | undefined) || existing?.phone,
          avatar: (session.user.user_metadata?.avatar as string | undefined) || existing?.avatar,
          skills: (Array.isArray(session.user.user_metadata?.skills) ? session.user.user_metadata.skills : existing?.skills) || [],
          alertLatitude: existing?.alertLatitude ?? null,
          alertLongitude: existing?.alertLongitude ?? null,
          alertsEnabled: existing?.alertsEnabled ?? true,
          createdAt: new Date(session.user.created_at || Date.now()),
          updatedAt: new Date(),
        };
        await useAuthStore.getState().setAuth(minimalUser, session.access_token, session.refresh_token ?? '');
      } finally {
        markChecked();
        hasDoneInitialReconcile.current = true;
      }
    };

    const clearIfSignedOut = async (alsoLocalSignOut = false) => {
      try {
        if (alsoLocalSignOut) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
      } finally {
        await useAuthStore.getState().clearAuth();
        markChecked();
        hasDoneInitialReconcile.current = true;
      }
    };

    const reconcileSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await applySession(data.session);
        } else {
          await clearIfSignedOut(false);
        }
      } catch {
        // Network or other transient error — do not log the user out from persisted state aggressively.
        // Mark checked so the app can render (it will use whatever persisted state we have).
        markChecked();
        hasDoneInitialReconcile.current = true;
      }
    };

    // Initial reconcile after zustand is ready (this is the critical gate for "login appearing" bug)
    const scheduleInitialReconcile = () => {
      if (useAuthStore.persist.hasHydrated()) {
        void reconcileSession();
      } else {
        unsubHydration = useAuthStore.persist.onFinishHydration(() => {
          void reconcileSession();
        });
      }
    };

    scheduleInitialReconcile();

    // Listen to all Supabase auth events. This is the heart of keeping state correct across refresh, sign-in, expiry, etc.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (!useAuthStore.persist.hasHydrated()) {
        // Defer until we have our persisted baseline
        return;
      }

      switch (event) {
        case 'SIGNED_OUT':
          await clearIfSignedOut(false);
          break;

        case 'TOKEN_REFRESHED':
        case 'INITIAL_SESSION':
        case 'SIGNED_IN':
          if (session?.user) {
            // For TOKEN_REFRESHED we can be lighter: just patch the tokens + keep current user (profile rarely changes)
            if (event === 'TOKEN_REFRESHED') {
              const current = useAuthStore.getState();
              if (current.user && current.isAuthenticated) {
                useAuthStore.getState().patchTokens(session.access_token, session.refresh_token ?? '');
              } else {
                // Rare: refresh brought a session but we had no user — treat as full sign in
                await applySession(session);
              }
            } else {
              await applySession(session);
            }
          }
          break;

        default:
          // USER_UPDATED, PASSWORD_RECOVERY, etc. — nothing to do for routing, but a future profile refresh could be added.
          break;
      }

      markChecked();
    });

    // When the app comes back to foreground, do a light session check.
    // This catches cases where the token silently expired while the app was backgrounded.
    appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const s = useAuthStore.getState();
        if (s.isAuthenticated) {
          // Fire-and-forget; do not block UI. If getSession returns nothing we will clear via the listener or explicit check.
          void supabase.auth.getSession().then(({ data }) => {
            if (!data.session && s.isAuthenticated) {
              void clearIfSignedOut(true);
            }
          });
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      unsubHydration?.();
      subscription.unsubscribe();
      if (appStateSub?.remove) appStateSub.remove();
      else if (appStateSub) appStateSub.remove?.();
    };
  }, []);

  return null;
}
