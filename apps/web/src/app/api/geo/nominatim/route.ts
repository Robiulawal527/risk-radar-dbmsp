import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM_ORIGIN = 'https://nominatim.openstreetmap.org';

export type SanitizedNominatimHit = {
  lat: number;
  lng: number;
  displayName: string;
  address?: string;
  area?: string;
  district?: string;
  division?: string;
  boundingBox?: readonly [number, number, number, number];
};

function pickAddressPart(address: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function sanitizeRow(row: unknown): SanitizedNominatimHit | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lon);
  const displayName = typeof o.display_name === 'string' ? o.display_name : '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !displayName) return null;

  const rawAddress =
    o.address && typeof o.address === 'object' ? (o.address as Record<string, unknown>) : {};
  const area = pickAddressPart(
    rawAddress,
    'suburb',
    'neighbourhood',
    'quarter',
    'city_district',
    'town',
    'village',
    'municipality',
    'city'
  );
  const district = pickAddressPart(rawAddress, 'county', 'district', 'state_district', 'city');
  const division = pickAddressPart(rawAddress, 'state', 'region');

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

  return {
    lat,
    lng,
    displayName,
    address: displayName,
    area,
    district,
    division,
    boundingBox,
  };
}

/** Server proxy: browser → our API → Nominatim (CORS-safe, stable User-Agent for OSM policy). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const lat = req.nextUrl.searchParams.get('lat');
  const lng = req.nextUrl.searchParams.get('lng');

  const reverseLat = lat ? Number(lat) : NaN;
  const reverseLng = lng ? Number(lng) : NaN;
  const reverse = Number.isFinite(reverseLat) && Number.isFinite(reverseLng);

  if (!reverse && (!q || q.length < 2)) {
    return NextResponse.json({ error: 'Provide a query or GPS coordinates.' }, { status: 400 });
  }

  const url = new URL(reverse ? '/reverse' : '/search', NOMINATIM_ORIGIN);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  if (reverse) {
    url.searchParams.set('lat', String(reverseLat));
    url.searchParams.set('lon', String(reverseLng));
    url.searchParams.set('zoom', '18');
  } else {
    url.searchParams.set('q', q!);
    url.searchParams.set('countrycodes', 'bd');
    url.searchParams.set('limit', '5');
  }

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

  const rawRows = reverse ? [raw] : raw;
  if (!Array.isArray(rawRows)) {
    return NextResponse.json({ error: 'Unexpected geocoder response.' }, { status: 502 });
  }

  const items: SanitizedNominatimHit[] = [];
  for (const row of rawRows) {
    const item = sanitizeRow(row);
    if (item) items.push(item);
  }

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
