import { CrimeType, Severity, type Crime, type CrimeStats } from '@risk-radar/types';
import { supabase, isSupabaseConfigured } from './supabase';

function configuredTableCandidates(): string[] {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_CRIME_TABLE?.trim();
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const defaults = ['crimes', 'crime', 'Crime', 'incidents'];
  const seen = new Set<string>();
  return [...fromEnv, ...defaults].filter((name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

async function detectReadableCrimeTable(): Promise<string> {
  const tried: string[] = [];
  for (const name of configuredTableCandidates()) {
    tried.push(name);
    const { error } = await supabase.from(name).select('*').limit(1);
    if (!error) return name;
  }
  throw new Error(`No readable crime table found. Tried: ${tried.join(', ')}`);
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).length) return String(value);
  }
  return undefined;
}

function pickNum(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function pickDate(row: Record<string, unknown>, ...keys: string[]): Date | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

function asCrimeType(value?: string): CrimeType {
  return value && (Object.values(CrimeType) as string[]).includes(value) ? (value as CrimeType) : CrimeType.OTHER;
}

function asSeverity(value?: string): Severity {
  return value && (Object.values(Severity) as string[]).includes(value) ? (value as Severity) : Severity.MEDIUM;
}

export function mapCrimeRowLoose(row: Record<string, unknown>): Crime | null {
  const id = pickStr(row, 'id');
  const latitude = pickNum(row, 'latitude', 'lat');
  const longitude = pickNum(row, 'longitude', 'lng', 'lon');
  if (!id || latitude === undefined || longitude === undefined) return null;

  const typeRaw = pickStr(row, 'type', 'crime_type') ?? 'OTHER';
  const categoryRaw = pickStr(row, 'category', 'crime_category') ?? typeRaw;
  const now = new Date();
  const dateTime = pickDate(row, 'dateTime', 'date_time', 'occurred_at', 'incident_date') ?? now;
  const createdAt = pickDate(row, 'createdAt', 'created_at') ?? dateTime;
  const updatedAt = pickDate(row, 'updatedAt', 'updated_at') ?? createdAt;

  return {
    id,
    type: asCrimeType(typeRaw),
    category: asCrimeType(categoryRaw),
    title: pickStr(row, 'title', 'name', 'summary') ?? 'Incident',
    description: pickStr(row, 'description', 'details', 'body') ?? '',
    location: {
      latitude,
      longitude,
      address: pickStr(row, 'address', 'location_address'),
      area: pickStr(row, 'area', 'neighborhood', 'thana'),
      district: pickStr(row, 'district', 'city_district'),
      division: pickStr(row, 'division', 'region'),
    },
    severity: asSeverity(pickStr(row, 'severity', 'risk_level')),
    status: pickStr(row, 'status') ?? 'REPORTED',
    reportedBy: pickStr(row, 'reportedBy', 'reported_by', 'reporter_id', 'user_id') ?? 'unknown',
    dateTime,
    createdAt,
    updatedAt,
  };
}

async function fetchRowsOrdered(table: string, limit: number): Promise<Record<string, unknown>[]> {
  const orderAttempts = ['created_at', 'createdAt', 'date_time', 'dateTime', 'updated_at', 'updatedAt'];
  const withGeoNullFilter = () =>
    supabase.from(table).select('*').not('latitude', 'is', null).not('longitude', 'is', null);

  for (const col of orderAttempts) {
    const { data, error } = await withGeoNullFilter().order(col, { ascending: false }).limit(limit);
    if (!error && data) return data as Record<string, unknown>[];
  }

  const { data: filteredData, error: filteredError } = await withGeoNullFilter().limit(limit);
  if (!filteredError && filteredData) return filteredData as Record<string, unknown>[];

  for (const col of orderAttempts) {
    const { data, error } = await supabase.from(table).select('*').order(col, { ascending: false }).limit(limit);
    if (!error && data) return data as Record<string, unknown>[];
  }

  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

export async function fetchCrimesForMapFromSupabase(limit = 2000): Promise<Crime[]> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const table = await detectReadableCrimeTable();
  const rows = await fetchRowsOrdered(table, limit);
  return rows.map(mapCrimeRowLoose).filter((crime): crime is Crime => Boolean(crime));
}

export function filterCrimesByAreaQuery(crimes: Crime[], query: string): Crime[] {
  const q = query.trim().toLowerCase();
  if (!q) return crimes;
  return crimes.filter((crime) =>
    [
      crime.location.area,
      crime.location.district,
      crime.location.address,
      crime.location.division,
      crime.title,
      crime.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q)
  );
}

export function buildStatsFromCrimes(crimes: Crime[]): CrimeStats {
  const crimesByType = Object.fromEntries(Object.values(CrimeType).map((type) => [type, 0])) as Record<CrimeType, number>;
  const crimesBySeverity = Object.fromEntries(Object.values(Severity).map((severity) => [severity, 0])) as Record<Severity, number>;
  const areaCounts = new Map<string, number>();
  const trendCounts = new Map<string, number>();

  for (const crime of crimes) {
    crimesByType[crime.type] = (crimesByType[crime.type] ?? 0) + 1;
    crimesBySeverity[crime.severity] = (crimesBySeverity[crime.severity] ?? 0) + 1;
    const area = crime.location.area || crime.location.district || 'Unknown area';
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    const day = new Date(crime.createdAt || crime.dateTime).toISOString().slice(0, 10);
    trendCounts.set(day, (trendCounts.get(day) ?? 0) + 1);
  }

  const maxArea = Math.max(1, ...areaCounts.values());
  const crimesByArea = [...areaCounts.entries()]
    .map(([area, count]) => ({
      area,
      count,
      riskLevel:
        count >= maxArea * 0.75
          ? Severity.CRITICAL
          : count >= maxArea * 0.45
            ? Severity.HIGH
            : count >= maxArea * 0.2
              ? Severity.MEDIUM
              : Severity.LOW,
    }))
    .sort((a, b) => b.count - a.count);

  const trends = [...trendCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));

  return {
    totalCrimes: crimes.length,
    crimesByType,
    crimesBySeverity,
    crimesByArea,
    trends,
  };
}
