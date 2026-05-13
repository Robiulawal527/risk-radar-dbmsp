import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiOrigin } from '@/lib/backend-upstream';
import { forwardHeaders, HOP_BY_HOP } from '@/lib/backend-proxy-headers';

export const dynamic = 'force-dynamic';
/** Edge avoids a dev/build bug where the Node app-route chunk for this catch-all throws `__webpack_require__.C is not a function` during static path generation. */
export const runtime = 'edge';

async function proxy(req: NextRequest, context: { params: { path: string[] } }): Promise<NextResponse> {
  const segments = context.params.path ?? [];
  const subpath = segments.join('/');
  const origin = getUpstreamApiOrigin();
  const target = `${origin}/api/${subpath}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders(req),
    cache: 'no-store',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, { ...init, signal: AbortSignal.timeout(60_000) });

    if (
      !upstream.ok &&
      upstream.status === 404 &&
      req.method === 'GET' &&
      subpath === 'notifications'
    ) {
      await upstream.arrayBuffer();
      return NextResponse.json({ success: true, data: [] }, { headers: { 'content-type': 'application/json' } });
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
    if (req.method === 'GET' && subpath === 'notifications') {
      return NextResponse.json({ success: true, data: [] }, { headers: { 'content-type': 'application/json' } });
    }
    return NextResponse.json(
      {
        success: false,
        error: `Cannot reach API at ${origin}. Start the backend from the repo root: pnpm backend`,
      },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
