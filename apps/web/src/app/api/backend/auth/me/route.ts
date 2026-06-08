import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { supabaseAuthMeFallback } from '@/lib/supabase-auth-me-fallback';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.length < 12) {
    return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
  }

  const origin = getUpstreamApiOrigin();
  if (upstreamTargetsThisNextServer(req, origin)) {
    return supabaseAuthMeFallback(authorization);
  }

  const target = `${origin}/api/auth/me${req.nextUrl.search}`;
  const init: RequestInit = {
    method: 'GET',
    headers: forwardHeaders(req),
    cache: 'no-store',
  };

  try {
    const upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(60_000) });
    if (!upstream.ok) {
      await upstream.arrayBuffer();
      return supabaseAuthMeFallback(authorization);
    }
    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      if (!HOP_BY_HOP.has(k.toLowerCase())) {
        headers.set(k, v);
      }
    });
    return new NextResponse(body, { status: upstream.status, headers });
  } catch {
    return supabaseAuthMeFallback(authorization);
  }
}
