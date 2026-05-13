import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM_ORIGIN = 'https://nominatim.openstreetmap.org';

export type SanitizedNominatimHit = {
  lat: number;
  lng: number;
  displayName: string;
  boundingBox?: readonly [number, number, number, number];
};

/** Server proxy: browser → our API → Nominatim (CORS-safe, stable User-Agent for OSM policy). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Provide a query of at least 2 characters.' }, { status: 400 });
  }

  const url = new URL('/search', NOMINATIM_ORIGIN);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', q);
  url.searchParams.set('countrycodes', 'bd');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        /**
         * Nominatim requires an identifiable UA; repo URL is informational only (adjust if you fork).
         * No secrets here.
         */
        'User-Agent': 'risk-radar-web/heatmap-dashboard (Bangladesh placename search)',
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach geocoding service.' }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: upstream.status === 429 ? 'Geocoding rate limited. Try again shortly.' : 'Geocoding request failed.' },
      { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 }
    );
  }

  let raw: unknown;
  try {
    raw = await upstream.json();
  } catch {
    return NextResponse.json({ error: 'Invalid response from geocoding service.' }, { status: 502 });
  }

  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: 'Unexpected geocoder response.' }, { status: 502 });
  }

  const items: SanitizedNominatimHit[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lon);
    const dn = typeof o.display_name === 'string' ? o.display_name : '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dn) continue;

    let boundingBox: [number, number, number, number] | undefined;
    const bb = o.boundingbox;
    if (Array.isArray(bb) && bb.length >= 4) {
      const south = Number(bb[0]);
      const north = Number(bb[1]);
      const west = Number(bb[2]);
      const east = Number(bb[3]);
      if ([south, north, west, east].every(Number.isFinite)) {
        boundingBox = [south, north, west, east];
      }
    }
    items.push({ lat, lng, displayName: dn, boundingBox });
  }

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
