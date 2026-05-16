import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

const url = env.supabaseUrl.trim();
const key = env.supabaseAnonKey.trim();

if (!url || !key) {
  console.warn(
    '[Risk Radar] Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env then restart Expo.'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
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

  return createClient(
    url || 'https://placeholder.supabase.co',
    key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
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
  return Boolean(url && key);
}
