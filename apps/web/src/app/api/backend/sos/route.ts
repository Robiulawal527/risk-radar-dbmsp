import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

async function proxyToBackend(req: NextRequest) {
  const origin = getUpstreamApiOrigin();
  if (upstreamTargetsThisNextServer(req, origin)) return null;

  const upstream = await fetch(`${origin}/api/sos${req.nextUrl.search}`, {
    method: req.method,
    headers: forwardHeaders(req),
    body:
      req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.clone().arrayBuffer(),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });

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

async function postFallback(req: NextRequest) {
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
  if (authError || !authData.user) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    location?: {
      latitude?: number;
      longitude?: number;
      address?: string;
      area?: string;
      district?: string;
      division?: string;
    };
    message?: string;
  };
  const location = body.location;
  if (
    !location ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number'
  ) {
    return NextResponse.json({ success: false, error: 'Location is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sos_alerts')
    .insert({
      id: Math.floor(Date.now() * 1000 + Math.random() * 1000),
      user_id: authData.user.id,
      latitude: location.latitude,
      longitude: location.longitude,
      message: body.message ?? null,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    const isMissingTable = /schema cache|could not find the table/i.test(error.message);
    return NextResponse.json(
      {
        success: false,
        error: isMissingTable
          ? 'SOS storage is not configured yet. Apply the database schema before deploying.'
          : error.message,
      },
      { status: isMissingTable ? 503 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      userId: data.user_id ?? data.userId,
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
        address: location.address ?? undefined,
        area: location.area ?? undefined,
        district: location.district ?? undefined,
        division: location.division ?? undefined,
      },
      status: data.status,
      message: data.message ?? undefined,
      createdAt: data.createdAt ?? data.created_at,
      resolvedAt: data.resolvedAt ?? data.resolved_at ?? undefined,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const upstream = await proxyToBackend(req);
    if (upstream) return upstream;
  } catch {
    // Fall back to Supabase direct insert.
  }
  return postFallback(req);
}
