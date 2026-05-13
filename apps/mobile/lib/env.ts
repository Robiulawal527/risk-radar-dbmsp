function resolveApiUrl(): string {
  const local = process.env.EXPO_PUBLIC_API_URL_LOCAL?.trim();
  const deployed = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fallback = 'http://127.0.0.1:3001/api';
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return local || fallback;
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
