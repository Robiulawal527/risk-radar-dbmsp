import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const getSupabaseKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

export const createClient = () => createBrowserClient(getSupabaseUrl()!, getSupabaseKey()!);

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  browserClient = createClient();
  return browserClient;
}
