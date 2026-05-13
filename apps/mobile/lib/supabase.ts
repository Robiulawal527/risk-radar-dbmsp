import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
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
