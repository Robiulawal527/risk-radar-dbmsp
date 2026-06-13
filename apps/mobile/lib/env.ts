import Constants from 'expo-constants';

function resolveApiUrl(): string {
  const local = process.env.EXPO_PUBLIC_API_URL_LOCAL?.trim();
  const deployed = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fallback = 'http://127.0.0.1:3001/api';

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // In development we strongly prefer talking to a locally running backend
    // (the one started by `pnpm dev` / turbo from the repo root).
    // Only trust EXPO_PUBLIC_API_URL_LOCAL if it clearly points at a local/dev address.
    // This prevents a "deployed" URL that was left in .env from overriding the local backend.
    if (local && isLocalDevUrl(local)) {
      return local;
    }

    // Prefer Expo's detected host (e.g. 192.168.x.x when running on LAN from phone) so the mobile app
    // can reach a locally running backend on the same computer over the network.
    // This is the magic that makes `pnpm dev` (full stack) work smoothly for physical devices.
    const debuggerHost =
      (Constants as any)?.expoConfig?.hostUri?.split(':')[0] ||
      (Constants as any)?.manifest?.debuggerHost?.split(':')[0] ||
      (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost?.split(':')[0];
    const host = debuggerHost || '127.0.0.1';
    return `http://${host}:3001/api`;
  }

  return deployed || local || fallback;
}

/** Returns true if the URL looks like it points to a locally running backend during dev. */
function isLocalDevUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (!u) return false;
  // Common local patterns
  if (u.includes('localhost') || u.includes('127.0.0.1') || u.includes(':3001')) return true;
  // Private LAN ranges commonly used for dev (192.168.x, 10.x, 172.16-31.x)
  if (/https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(u)) return true;
  return false;
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
