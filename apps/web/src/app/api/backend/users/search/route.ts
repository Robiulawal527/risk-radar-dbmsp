import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar: string | null;
  role: string | null;
  skills: string[] | null;
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

function toUser(row: SearchProfileRow) {
  const email = row.email || '';
  return {
    id: row.id,
    userId: row.id,
    email,
    name: row.full_name || email.split('@')[0] || 'User',
    phone: row.phone ?? undefined,
    avatar: row.avatar ?? undefined,
    role: row.role || 'USER',
    skills: row.skills ?? [],
  };
}

async function proxyToBackend(req: NextRequest) {
  const origin = getUpstreamApiOrigin();
  if (upstreamTargetsThisNextServer(req, origin)) return null;

  const target = `${origin}/api/users/search${req.nextUrl.search}`;
  const upstream = await fetch(target, {
    method: 'GET',
    headers: forwardHeaders(req),
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

async function searchFallback(req: NextRequest) {
  const skill = req.nextUrl.searchParams.get('skill')?.trim();
  if (!skill) {
    return NextResponse.json({ success: false, message: 'Skill query required' }, { status: 400 });
  }

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

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, avatar, role, skills')
    .order('full_name', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ success: true, data: [] });
  }

  const needle = skill.toLowerCase();
  const matches = ((data ?? []) as SearchProfileRow[])
    .filter((row) => row.id !== authData.user.id)
    .filter((row) => (row.skills ?? []).some((ownSkill) => ownSkill.toLowerCase().includes(needle)))
    .map(toUser);

  return NextResponse.json({ success: true, data: matches });
}

export async function GET(req: NextRequest) {
  try {
    const upstream = await proxyToBackend(req);
    if (upstream) return upstream;
  } catch {
    // Fall through to Supabase when the Express backend is unavailable.
  }
  return searchFallback(req);
}
