import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const getSupabaseKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export const createClient = async (cookieStore?: CookieStore) => {
  const resolvedCookieStore = cookieStore ?? (await cookies());
  return createServerClient(getSupabaseUrl()!, getSupabaseKey()!, {
    cookies: {
      getAll() {
        return resolvedCookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            resolvedCookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot set cookies directly; middleware refreshes sessions.
        }
      },
    },
  });
};
