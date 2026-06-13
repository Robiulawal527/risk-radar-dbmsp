import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

const url = env.supabaseUrl?.trim() ?? '';
const key = env.supabaseAnonKey?.trim() ?? '';

const isConfigured = Boolean(url && key);

if (!isConfigured) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      '[Risk Radar] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY). ' +
      'Supabase features (map, realtime alerts, auth) will be limited. Set them in apps/mobile/.env or root .env.local and run `pnpm env:sync`.'
    );
  } else {
    // In production builds we want a loud signal if the client was built without keys.
    console.error(
      '[Risk Radar] CRITICAL: Supabase is not configured in this production build. ' +
      'Make sure EXPO_PUBLIC_SUPABASE_* variables were present at build time (EAS / Expo build).'
    );
  }
}

export const supabase = createClient(
  isConfigured ? url : 'https://placeholder.supabase.co',
  isConfigured ? key : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export function supabaseWithAccessToken(accessToken?: string | null): SupabaseClient {
  const token = accessToken?.trim();
  if (!token) return supabase;

  if (!isConfigured) {
    return supabase; // will be the placeholder; callers should guard with isSupabaseConfigured()
  }

  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export function isSupabaseConfigured(): boolean {
  return isConfigured;
}
