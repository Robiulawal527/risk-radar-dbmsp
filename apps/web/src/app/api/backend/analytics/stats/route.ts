import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { analyticsStatsFallback } from '@/lib/supabase-crimes-fallback';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const origin = getUpstreamApiOrigin();

  if (upstreamTargetsThisNextServer(req, origin)) {
    return analyticsStatsFallback(req);
  }

  const target = `${origin}/api/analytics/stats${req.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok && upstream.status === 404) {
      await upstream.arrayBuffer();
      return analyticsStatsFallback(req);
    }

    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
    });
    return new NextResponse(body, { status: upstream.status, headers });
  } catch {
    return analyticsStatsFallback(req);
  }
}
