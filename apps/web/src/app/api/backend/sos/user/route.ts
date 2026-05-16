import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SosRow = {
  id: string;
  userId?: string;
  user_id?: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  area?: string | null;
  district?: string | null;
  division?: string | null;
  message?: string | null;
  status: string;
  createdAt?: string | null;
  created_at?: string | null;
  resolvedAt?: string | null;
  resolved_at?: string | null;
};

function clientFor(authorization: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toSOSRequest(row: SosRow, userId: string) {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id ?? userId,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address ?? undefined,
      area: row.area ?? undefined,
      district: row.district ?? undefined,
      division: row.division ?? undefined,
    },
    status: row.status,
    message: row.message ?? undefined,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    resolvedAt: row.resolvedAt ?? row.resolved_at ?? undefined,
  };
}

async function proxyToBackend(req: NextRequest) {
  const origin = getUpstreamApiOrigin();
  if (upstreamTargetsThisNextServer(req, origin)) return null;

  const upstream = await fetch(`${origin}/api/sos/user${req.nextUrl.search}`, {
    method: 'GET',
    headers: forwardHeaders(req),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });

  if (!upstream.ok && upstream.status === 404) {
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

async function fallback(req: NextRequest) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
  }

  const supabase = clientFor(authorization);
  if (!supabase) {
    return NextResponse.json({ success: true, data: [] });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from('SOSRequest')
    .select('*')
    .eq('userId', authData.user.id)
    .order('createdAt', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: true, data: [] });
  }

  return NextResponse.json({
    success: true,
    data: ((data ?? []) as SosRow[]).map((row) => toSOSRequest(row, authData.user.id)),
  });
}

export async function GET(req: NextRequest) {
  try {
    const upstream = await proxyToBackend(req);
    if (upstream) return upstream;
  } catch {
    // Fall back to Supabase or an empty list.
  }
  return fallback(req);
}
