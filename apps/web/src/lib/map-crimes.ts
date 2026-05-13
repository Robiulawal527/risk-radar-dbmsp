import { CrimeType, Severity, type Crime } from '@/lib/types';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

function configuredTableCandidates(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_CRIME_TABLE?.trim();
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  /** Prefer env order, then common PostgREST names (`crimes` vs quoted `"Crime"`). */
  const defaults = ['crimes', 'crime', 'Crime', 'incidents'];
  const merged = [...fromEnv, ...defaults];
  const seen = new Set<string>();
  return merged.filter((name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

/**
 * Detect which table exists and is readable (minimal SELECT).
 */
async function detectReadableCrimeTable(supabase: SupabaseClient): Promise<string> {
  const tried: string[] = [];
  for (const name of configuredTableCandidates()) {
    tried.push(name);
    const { error } = await supabase.from(name).select('*').limit(1);
    if (!error) return name;
  }
  throw new Error(
    `No readable incidents table found. Create one or set NEXT_PUBLIC_SUPABASE_CRIME_TABLE (comma-separated fallbacks). Tried: ${tried.join(
      ', '
    )}. In SQL, quoted "Crime" is exposed as "Crime"; unquoted crime becomes public.crime.`
  );
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).length) return String(v);
  }
  return undefined;
}

function pickNum(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function pickDate(row: Record<string, unknown>, ...keys: string[]): Date | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

/** Normalize a Supabase row whether columns are camelCase (Prisma-style) or snake_case. */
export function mapCrimeRowLoose(row: Record<string, unknown>): Crime | null {
  const id = pickStr(row, 'id');
  const lat = pickNum(row, 'latitude', 'lat');
  const lng = pickNum(row, 'longitude', 'lng', 'lon');
  if (!id || lat === undefined || lng === undefined) return null;

  const typeRaw = pickStr(row, 'type', 'crime_type') ?? 'OTHER';
  const categoryRaw = pickStr(row, 'category', 'crime_category') ?? typeRaw;

  const asCrimeType = (v: string): CrimeType =>
    (Object.values(CrimeType) as string[]).includes(v) ? (v as CrimeType) : CrimeType.OTHER;
  const asSeverity = (v: string): Severity =>
    (Object.values(Severity) as string[]).includes(v) ? (v as Severity) : Severity.MEDIUM;

  const title = pickStr(row, 'title', 'name', 'summary') ?? 'Incident';
  const description = pickStr(row, 'description', 'details', 'body') ?? '';
  const severityRaw = pickStr(row, 'severity', 'risk_level') ?? 'MEDIUM';
  const status = pickStr(row, 'status') ?? 'REPORTED';
  const reportedBy = pickStr(row, 'reportedBy', 'reported_by', 'reporter_id', 'user_id') ?? 'unknown';

  const now = new Date();
  const dateTime = pickDate(row, 'dateTime', 'date_time', 'occurred_at', 'incident_date') ?? now;
  const createdAt = pickDate(row, 'createdAt', 'created_at') ?? dateTime;
  const updatedAt = pickDate(row, 'updatedAt', 'updated_at') ?? createdAt;

  return {
    id,
    type: asCrimeType(typeRaw),
    category: asCrimeType(categoryRaw),
    title,
    description,
    location: {
      latitude: lat,
      longitude: lng,
      address: pickStr(row, 'address', 'location_address'),
      area: pickStr(row, 'area', 'neighborhood', 'thana'),
      district: pickStr(row, 'district', 'city_district'),
      division: pickStr(row, 'division', 'region'),
    },
    severity: asSeverity(severityRaw),
    reportedBy,
    status,
    dateTime,
    createdAt,
    updatedAt,
  };
}

async function fetchRowsOrdered(
  supabase: SupabaseClient,
  table: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const orderAttempts = ['created_at', 'createdAt', 'date_time', 'dateTime', 'updated_at', 'updatedAt'];

  const withGeoNullFilter = () =>
    supabase.from(table).select('*').not('latitude', 'is', null).not('longitude', 'is', null);

  for (const col of orderAttempts) {
    const { data, error } = await withGeoNullFilter().order(col, { ascending: false }).limit(limit);
    if (!error && data) return data as Record<string, unknown>[];
  }
  {
    const { data, error } = await withGeoNullFilter().limit(limit);
    if (!error && data) return data as Record<string, unknown>[];
  }

  /** Some schemas use `lat`/`lng` instead of `latitude`/`longitude` — skip SQL null filters. */
  for (const col of orderAttempts) {
    const { data, error } = await supabase.from(table).select('*').order(col, { ascending: false }).limit(limit);
    if (!error && data) return data as Record<string, unknown>[];
  }

  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Loads incidents from Supabase for the live heatmap.
 * Auto-detects table name (`crimes`, `Crime`, etc.) and camelCase vs snake_case columns.
 */
export async function fetchCrimesForMapFromSupabase(limit = 2000): Promise<Crime[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  const table = await detectReadableCrimeTable(supabase);
  const rows = await fetchRowsOrdered(supabase, table, limit);

  const crimes: Crime[] = [];
  for (const row of rows) {
    const c = mapCrimeRowLoose(row);
    if (c) crimes.push(c);
  }
  return crimes;
}

export function filterCrimesByAreaQuery(crimes: Crime[], query: string): Crime[] {
  const q = query.trim().toLowerCase();
  if (!q) return crimes;
  return crimes.filter((c) => {
    const blob = [
      c.location.area,
      c.location.district,
      c.location.address,
      c.location.division,
      c.title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}
