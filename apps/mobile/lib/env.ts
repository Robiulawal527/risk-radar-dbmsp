import Constants from 'expo-constants';

function resolveApiUrl(): string {
  const local = process.env.EXPO_PUBLIC_API_URL_LOCAL?.trim();
  const deployed = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fallback = 'http://127.0.0.1:3001/api';
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (local) return local;
    // Prefer Expo's detected host (e.g. 192.168.x.x when running on LAN from phone) so the mobile app
    // can reach a locally running backend on the same computer over the network.
    const debuggerHost =
      (Constants as any)?.expoConfig?.hostUri?.split(':')[0] ||
      (Constants as any)?.manifest?.debuggerHost?.split(':')[0] ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost?.split(':')[0];
    const host = debuggerHost || '127.0.0.1';
    return `http://${host}:3001/api`;
  }
  return deployed || local || fallback;
}

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    '',
  apiUrl: resolveApiUrl(),
  apiTimeout: Number(process.env.EXPO_PUBLIC_API_TIMEOUT ?? '10000') || 10000,
};
