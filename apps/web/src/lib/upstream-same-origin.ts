import type { NextRequest } from 'next/server';

/** True when configured upstream origin is this Next server (API URL same host:port as `next dev`). */
export function upstreamTargetsThisNextServer(req: NextRequest, upstreamOrigin: string): boolean {
  try {
    return new URL(upstreamOrigin).origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}
