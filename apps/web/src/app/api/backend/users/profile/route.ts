import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';
import { requireValidPhoneNumber } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar: string | null;
  role: string | null;
  skills: string[] | null;
  alert_latitude: number | null;
  alert_longitude: number | null;
  alerts_enabled: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return { url, key };
}

function clientFor(authorization: string) {
  const { url, key } = supabaseEnv();
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeSkills(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(String)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function normalizeCoordinate(value: unknown, field: string, min: number, max: number): number | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${field} must be between ${min} and ${max}.`);
  }
  return number;
}

function toApiUser(row: ProfileRow, fallbackEmail: string) {
  return {
    id: row.id,
    email: row.email || fallbackEmail,
    name: row.full_name || fallbackEmail.split('@')[0] || 'User',
    phone: row.phone ?? undefined,
    avatar: row.avatar ?? undefined,
    role: row.role?.toUpperCase() || 'USER',
    skills: row.skills ?? [],
    alertLatitude: row.alert_latitude ?? null,
    alertLongitude: row.alert_longitude ?? null,
    alertsEnabled: row.alerts_enabled ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function proxyToBackend(req: NextRequest) {
  const origin = getUpstreamApiOrigin();
  if (upstreamTargetsThisNextServer(req, origin)) return null;

  const target = `${origin}/api/users/profile${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders(req),
    cache: 'no-store',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.clone().arrayBuffer();
  }

  const upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(60_000) });
  if (!upstream.ok) {
    await upstream.arrayBuffer();
    return null;
  }

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  return new NextResponse(body, { status: upstream.status, headers });
}

async function getFallbackProfile(req: NextRequest) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
  }

  const supabase = clientFor(authorization);
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Supabase is not configured' },
      { status: 503 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice(7));
  if (authError || !authData.user?.email) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, phone, avatar, role, skills, alert_latitude, alert_longitude, alerts_enabled, created_at, updated_at'
    )
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error) {
    const metadata = authData.user.user_metadata ?? {};
    return NextResponse.json({
      success: true,
      data: {
        id: authData.user.id,
        email: authData.user.email,
        name:
          (typeof metadata.name === 'string' && metadata.name.trim()) ||
          authData.user.email.split('@')[0] ||
          'User',
        phone: typeof metadata.phone === 'string' ? metadata.phone : undefined,
        avatar: typeof metadata.avatar === 'string' ? metadata.avatar : undefined,
        role: 'USER',
        skills: Array.isArray(metadata.skills) ? metadata.skills.map(String) : [],
        alertLatitude: typeof metadata.alertLatitude === 'number' ? metadata.alertLatitude : null,
        alertLongitude:
          typeof metadata.alertLongitude === 'number' ? metadata.alertLongitude : null,
        alertsEnabled: typeof metadata.alertsEnabled === 'boolean' ? metadata.alertsEnabled : null,
      },
    });
  }

  const row = (data ?? {
    id: authData.user.id,
    email: authData.user.email,
    full_name: authData.user.user_metadata?.name,
    phone: authData.user.user_metadata?.phone,
    avatar: authData.user.user_metadata?.avatar,
    role: 'user',
    skills: [],
    alert_latitude: null,
    alert_longitude: null,
    alerts_enabled: null,
  }) as ProfileRow;

  return NextResponse.json({ success: true, data: toApiUser(row, authData.user.email) });
}

async function putFallbackProfile(req: NextRequest) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
  }

  const supabase = clientFor(authorization);
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Supabase is not configured' },
      { status: 503 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice(7));
  if (authError || !authData.user?.email) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {
    id: authData.user.id,
    email: authData.user.email,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === 'string') update.full_name = body.name.trim();
  if (typeof body.phone === 'string') {
    try {
      update.phone = requireValidPhoneNumber(body.phone) || null;
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Invalid phone number' },
        { status: 400 }
      );
    }
  }
  if (typeof body.avatar === 'string') update.avatar = body.avatar.trim();
  try {
    const alertLatitude = normalizeCoordinate(body.alertLatitude, 'Alert latitude', -90, 90);
    const alertLongitude = normalizeCoordinate(body.alertLongitude, 'Alert longitude', -180, 180);
    if (alertLatitude !== undefined) update.alert_latitude = alertLatitude;
    if (alertLongitude !== undefined) update.alert_longitude = alertLongitude;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid coordinates' },
      { status: 400 }
    );
  }
  if (typeof body.alertsEnabled === 'boolean') update.alerts_enabled = body.alertsEnabled;
  const skills = normalizeSkills(body.skills);
  if (skills) update.skills = skills;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(update, { onConflict: 'id' })
    .select(
      'id, email, full_name, phone, avatar, role, skills, alert_latitude, alert_longitude, alerts_enabled, created_at, updated_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: toApiUser(data as ProfileRow, authData.user.email),
  });
}

export async function GET(req: NextRequest) {
  try {
    const upstream = await proxyToBackend(req);
    if (upstream) return upstream;
  } catch {
    // Fall through to Supabase when the Express backend is unavailable.
  }
  return getFallbackProfile(req);
}

export async function PUT(req: NextRequest) {
  try {
    const upstream = await proxyToBackend(req);
    if (upstream) return upstream;
  } catch {
    // Fall through to Supabase when the Express backend is unavailable.
  }
  return putFallbackProfile(req);
}
