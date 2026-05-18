import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const getSupabaseKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

type CookieStore = ReturnType<typeof cookies>;

export const createClient = (cookieStore: CookieStore = cookies()) => {
  return createServerClient(getSupabaseUrl()!, getSupabaseKey()!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies directly; middleware refreshes sessions.
        }
      },
    },
  });
};
