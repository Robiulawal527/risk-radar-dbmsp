import { NextResponse } from 'next/server';

/** Resolve current user from Supabase JWT when Express is unreachable (isolated module for Route Handler bundling). */
export async function supabaseAuthMeFallback(authorization: string): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Backend is not running and Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL + anon/publishable key, or start the API (pnpm backend from repo root).',
      },
      { status: 503 }
    );
  }

  const token = authorization.slice(7).trim();
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  const u = data.user;
  const email = u.email ?? '';
  const name =
    (typeof u.user_metadata?.name === 'string' && u.user_metadata.name.trim()) ||
    email.split('@')[0] ||
    'User';

  return NextResponse.json({
    success: true,
    data: {
      id: u.id,
      email,
      name,
      phone: (typeof u.user_metadata?.phone === 'string' ? u.user_metadata.phone : undefined) ?? undefined,
      avatar: (typeof u.user_metadata?.avatar === 'string' ? u.user_metadata.avatar : undefined) ?? undefined,
      role: 'USER',
      alertLatitude: null,
      alertLongitude: null,
      alertsEnabled: null,
      createdAt: u.created_at,
      updatedAt: new Date().toISOString(),
    },
  });
}
