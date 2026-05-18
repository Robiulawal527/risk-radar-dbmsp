import { NextResponse } from 'next/server';

const ACTIVE_ADMIN_STATUSES = new Set(['ACTIVE', 'APPROVED', 'VERIFIED', 'ENABLED']);

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
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  const u = data.user;
  const email = u.email ?? '';
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, phone, avatar, role, skills, alert_latitude, alert_longitude, alerts_enabled'
    )
    .eq('id', u.id)
    .maybeSingle();
  let { data: admin } = await supabase
    .from('admins')
    .select('id, status')
    .eq('id', u.id)
    .maybeSingle();
  if (!admin && email) {
    const byEmail = await supabase
      .from('admins')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();
    admin = byEmail.data;
  }
  const profileData = (profile ?? {}) as Record<string, unknown>;
  const adminData = (admin ?? {}) as Record<string, unknown>;
  const metadata = u.user_metadata ?? {};
  const profileRole =
    typeof profileData.role === 'string' ? profileData.role.trim().toUpperCase() : '';
  const adminActive =
    typeof adminData.status === 'string'
      ? ACTIVE_ADMIN_STATUSES.has(adminData.status.trim().toUpperCase())
      : false;
  const name =
    (typeof profileData.full_name === 'string' && profileData.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    email.split('@')[0] ||
    'User';

  return NextResponse.json({
    success: true,
    data: {
      id: u.id,
      email,
      name,
      phone:
        (typeof profileData.phone === 'string' ? profileData.phone : undefined) ??
        (typeof metadata.phone === 'string' ? metadata.phone : undefined) ??
        undefined,
      avatar:
        (typeof profileData.avatar === 'string' ? profileData.avatar : undefined) ??
        (typeof metadata.avatar === 'string' ? metadata.avatar : undefined) ??
        undefined,
      role: adminActive || profileRole === 'ADMIN' ? 'ADMIN' : 'USER',
      skills: Array.isArray(profileData.skills)
        ? profileData.skills.map(String)
        : Array.isArray(metadata.skills)
          ? metadata.skills.map(String)
          : [],
      alertLatitude:
        typeof profileData.alert_latitude === 'number'
          ? profileData.alert_latitude
          : typeof metadata.alertLatitude === 'number'
            ? metadata.alertLatitude
            : null,
      alertLongitude:
        typeof profileData.alert_longitude === 'number'
          ? profileData.alert_longitude
          : typeof metadata.alertLongitude === 'number'
            ? metadata.alertLongitude
            : null,
      alertsEnabled:
        typeof profileData.alerts_enabled === 'boolean'
          ? profileData.alerts_enabled
          : typeof metadata.alertsEnabled === 'boolean'
            ? metadata.alertsEnabled
            : null,
      createdAt: u.created_at,
      updatedAt: new Date().toISOString(),
    },
  });
}
