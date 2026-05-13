/** Client types for `/api/geo/nominatim` (OpenStreetMap Nominatim, restricted to Bangladesh). */

export type NominatimHit = {
  lat: number;
  lng: number;
  displayName: string;
  boundingBox?: readonly [number, number, number, number];
};

export async function nominatimSearchBangladesh(query: string, signal?: AbortSignal): Promise<NominatimHit[]> {
  const trimmed = query.trim();
  const res = await fetch(`/api/geo/nominatim?q=${encodeURIComponent(trimmed)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('Could not parse geocoder response.');
  }
  const err =
    body && typeof body === 'object' && 'error' in body ? String((body as { error?: unknown }).error ?? '') : '';
  if (!res.ok) {
    throw new Error(err || `Geocoding failed (${res.status})`);
  }
  const rawItems: unknown[] =
    body && typeof body === 'object' && 'items' in body && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown }).items as unknown[]
      : [];
  const items: NominatimHit[] = [];
  for (const row of rawItems) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    const displayName = typeof o.displayName === 'string' ? o.displayName : '';
    let boundingBox: [number, number, number, number] | undefined;
    const bb = o.boundingBox;
    if (Array.isArray(bb) && bb.length >= 4) {
      boundingBox = [Number(bb[0]), Number(bb[1]), Number(bb[2]), Number(bb[3])];
      if (!boundingBox.every(Number.isFinite)) boundingBox = undefined;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    items.push({ lat, lng, displayName, boundingBox });
  }
  return items;
}
