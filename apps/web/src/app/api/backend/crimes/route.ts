import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';
import { createCrimeFallback } from '@/lib/supabase-crimes-fallback';
import { upstreamTargetsThisNextServer } from '@/lib/upstream-same-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const origin = getUpstreamApiOrigin();
  const body = await req.arrayBuffer();

  if (upstreamTargetsThisNextServer(req, origin)) {
    return createCrimeFallback(new Request(req.url, { method: 'POST', headers: req.headers, body }));
  }

  const target = `${origin}/api/crimes${req.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: forwardHeaders(req),
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok && upstream.status === 404) {
      await upstream.arrayBuffer();
      return createCrimeFallback(new Request(req.url, { method: 'POST', headers: req.headers, body }));
    }

    const responseBody = await upstream.arrayBuffer();
    const headers = new Headers();
    upstream.headers.forEach((v, k) => {
      if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
    });
    return new NextResponse(responseBody, { status: upstream.status, headers });
  } catch {
    return createCrimeFallback(new Request(req.url, { method: 'POST', headers: req.headers, body }));
  }
}
