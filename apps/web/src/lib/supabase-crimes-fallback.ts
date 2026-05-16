import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CrimeType, Severity, type DashboardStats } from '@/lib/types';
import { emptyDashboardStats } from '@/lib/empty-dashboard-stats';

type ReportPayload = {
  type?: string;
  category?: string;
  title?: string;
  description?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    area?: string;
    district?: string;
    division?: string;
  };
  severity?: string;
  reportedBy?: string;
  dateTime?: string;
};

type SupabaseUser = {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

type ReportRow = Record<string, unknown>;

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return { url, anonKey, serviceKey };
}

function configuredTableCandidates(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_CRIME_TABLE?.trim();
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const merged = [...fromEnv, 'Crime', 'crimes', 'crime', 'incidents'];
  return Array.from(new Set(merged));
}

function validEnum<T extends Record<string, string>>(values: T, value: unknown, fallback: T[keyof T]) {
  return typeof value === 'string' && Object.values(values).includes(value) ? value : fallback;
}

function supabaseError(message: string, status = 503) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isSchemaShapeError(message: string): boolean {
  return /schema cache|column .* does not exist|could not find .* column|relation .* does not exist|table .* does not exist|does not exist/i.test(
    message
  );
}

function getBearer(req: Request): string | null {
  const authorization = req.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
}

async function resolveSupabaseUser(accessToken: string): Promise<SupabaseUser> {
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) {
    throw new Error('Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and anon/publishable key.');
  }

  const authClient = createClient(url, anonKey);
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    throw new Error('Invalid or expired token');
  }
  return data.user as SupabaseUser;
}

function dbClient(accessToken?: string): SupabaseClient {
  const { url, anonKey, serviceKey } = supabaseEnv();
  if (!url || (!anonKey && !serviceKey)) {
    throw new Error('Supabase database env is missing.');
  }

  return createClient(url, serviceKey || anonKey!, {
    global: accessToken && !serviceKey ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

async function findReadableTable(supabase: SupabaseClient): Promise<string> {
  const tried: string[] = [];
  for (const table of configuredTableCandidates()) {
    tried.push(table);
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) return table;
  }
  throw new Error(`No readable Crime table found. Tried: ${tried.join(', ')}.`);
}

async function syncUser(supabase: SupabaseClient, user: SupabaseUser): Promise<string> {
  const email = user.email ?? '';
  const name =
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    email.split('@')[0] ||
    'User';

  for (const table of ['User', 'users']) {
    const { data: existingByEmail, error: lookupError } = await supabase
      .from(table)
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (!lookupError && existingByEmail?.id) {
      return String(existingByEmail.id);
    }
    if (lookupError && !isSchemaShapeError(lookupError.message)) {
      continue;
    }

    const { error } = await supabase.from(table).upsert(
      {
        id: user.id,
        email,
        password: 'supabase-auth-user',
        name,
        phone: typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : null,
        role: 'USER',
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (!error) return user.id;
  }

  return user.id;
}

function normalizeReportPayload(payload: ReportPayload, user: SupabaseUser, userId: string): ReportRow {
  const lat = Number(payload.location?.latitude);
  const lng = Number(payload.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('GPS coordinates are required.');
  }

  const type = validEnum(CrimeType, payload.type, CrimeType.OTHER) as CrimeType;
  const severity = validEnum(Severity, payload.severity, Severity.MEDIUM) as Severity;
  const email = user.email ?? '';
  const reportedBy =
    payload.reportedBy?.trim() ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    email ||
    'Community reporter';
  const now = new Date().toISOString();

  return {
    type,
    category: validEnum(CrimeType, payload.category, type),
    title: payload.title?.trim() || 'Incident report',
    description: payload.description?.trim() || 'No description provided.',
    latitude: lat,
    longitude: lng,
    address: payload.location?.address ?? null,
    area: payload.location?.area?.trim() || null,
    district: payload.location?.district ?? null,
    division: payload.location?.division ?? null,
    severity,
    status: 'REPORTED',
    reportedBy,
    userId,
    victimInfo: {},
    criminalInfo: [],
    witnesses: [],
    dateTime: payload.dateTime || now,
    createdAt: now,
    updatedAt: now,
  };
}

function omitUndefined(row: ReportRow): ReportRow {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function uuidV4(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const value = Math.floor(Math.random() * 16);
      const next = char === 'x' ? value : (value & 0x3) | 0x8;
      return next.toString(16);
    })
  );
}

function withOptionalUuidId(row: ReportRow, reportId: string): ReportRow[] {
  return [omitUndefined({ id: reportId, ...row }), row];
}

function reportInsertAttempts(camel: ReportRow): ReportRow[] {
  const reportId = uuidV4();
  const crimesTable = omitUndefined({
    user_id: camel.userId,
    type: camel.type,
    category: camel.category,
    title: camel.title,
    description: camel.description,
    latitude: camel.latitude,
    longitude: camel.longitude,
    address: camel.address,
    area: camel.area,
    district: camel.district,
    division: camel.division,
    severity: camel.severity,
    reported_by: camel.reportedBy,
    status: camel.status,
    date_time: camel.dateTime,
    created_at: camel.createdAt,
    updated_at: camel.updatedAt,
  });

  const snake = omitUndefined({
    type: camel.type,
    category: camel.category,
    title: camel.title,
    description: camel.description,
    latitude: camel.latitude,
    longitude: camel.longitude,
    address: camel.address,
    area: camel.area,
    district: camel.district,
    division: camel.division,
    severity: camel.severity,
    status: camel.status,
    reported_by: camel.reportedBy,
    user_id: camel.userId,
    victim_info: camel.victimInfo,
    criminal_info: camel.criminalInfo,
    witnesses: camel.witnesses,
    date_time: camel.dateTime,
    created_at: camel.createdAt,
    updated_at: camel.updatedAt,
  });

  const common = omitUndefined({
    type: camel.type,
    category: camel.category,
    title: camel.title,
    description: camel.description,
    latitude: camel.latitude,
    longitude: camel.longitude,
    area: camel.area,
    severity: camel.severity,
    status: camel.status,
    reported_by: camel.reportedBy,
    reporter_id: camel.userId,
    user_id: camel.userId,
    occurred_at: camel.dateTime,
    created_at: camel.createdAt,
  });

  const minimal = omitUndefined({
    user_id: camel.userId,
    type: camel.type,
    category: camel.category,
    title: camel.title,
    description: camel.description,
    latitude: camel.latitude,
    longitude: camel.longitude,
    address: camel.address,
    area: camel.area,
    district: camel.district,
    division: camel.division,
    severity: camel.severity,
    status: camel.status,
    reported_by: camel.reportedBy,
    date_time: camel.dateTime,
    created_at: camel.createdAt,
  });

  const crimesTableMinimal = omitUndefined({
    user_id: camel.userId,
    type: camel.type,
    category: camel.category,
    title: camel.title,
    description: camel.description,
    latitude: camel.latitude,
    longitude: camel.longitude,
    address: camel.address,
    area: camel.area,
    district: camel.district,
    division: camel.division,
    severity: camel.severity,
    reported_by: camel.reportedBy,
    status: camel.status,
    date_time: camel.dateTime,
    created_at: camel.createdAt,
  });

  const appSchemaWithoutUser = omitUndefined({
    type: camel.type,
    category: camel.category,
    title: camel.title,
    description: camel.description,
    latitude: camel.latitude,
    longitude: camel.longitude,
    address: camel.address,
    area: camel.area,
    district: camel.district,
    division: camel.division,
    severity: camel.severity,
    status: camel.status,
    reportedBy: camel.reportedBy,
    victimInfo: camel.victimInfo,
    criminalInfo: camel.criminalInfo,
    witnesses: camel.witnesses,
    dateTime: camel.dateTime,
    createdAt: camel.createdAt,
    updatedAt: camel.updatedAt,
  });

  const attempts = [
    ...withOptionalUuidId(crimesTable, reportId),
    ...withOptionalUuidId(crimesTableMinimal, reportId),
    ...withOptionalUuidId(snake, reportId),
    ...withOptionalUuidId(common, reportId),
    ...withOptionalUuidId(minimal, reportId),
    omitUndefined({ id: reportId, ...camel }),
    appSchemaWithoutUser,
  ];
  const seen = new Set<string>();
  return attempts.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRetryablePayloadError(message: string): boolean {
  return /schema cache|column .* does not exist|could not find .* column|invalid input syntax for type bigint|null value in column "id"|violates not-null constraint/i.test(
    message
  );
}

async function insertReport(supabase: SupabaseClient, table: string, payload: ReportRow): Promise<ReportRow> {
  const attempts = reportInsertAttempts(payload);
  let lastError = 'Unknown insert error';

  for (const row of attempts) {
    const { error } = await supabase.from(table).insert(row);
    if (!error) return row;
    lastError = error.message;
    if (!isSchemaShapeError(error.message) && !isRetryablePayloadError(error.message)) break;
  }

  throw new Error(lastError);
}

function mapCrimeRow(row: Record<string, unknown>) {
  return {
    id: row.id ?? `local-${Date.now()}`,
    type: row.type,
    category: row.category ?? row.type,
    title: row.title,
    description: row.description,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address ?? undefined,
      area: row.area ?? undefined,
      district: row.district ?? undefined,
      division: row.division ?? undefined,
    },
    severity: row.severity,
    status: row.status ?? 'REPORTED',
    reportedBy: row.reportedBy ?? row.reported_by ?? 'Community reporter',
    dateTime: row.dateTime ?? row.date_time ?? row.createdAt ?? row.created_at,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

export async function createCrimeFallback(req: Request): Promise<NextResponse> {
  const token = getBearer(req);
  if (!token) return supabaseError('Missing bearer token', 401);

  try {
    const user = await resolveSupabaseUser(token);
    const supabase = dbClient(token);
    const userId = await syncUser(supabase, user);

    const table = await findReadableTable(supabase);
    const payload = normalizeReportPayload((await req.json()) as ReportPayload, user, userId);
    const data = await insertReport(supabase, table, payload);

    return NextResponse.json({ success: true, data: mapCrimeRow(data as Record<string, unknown>) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit report';
    return supabaseError(message, message.includes('token') ? 401 : 500);
  }
}

function getString(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return '';
}

function getDate(row: Record<string, unknown>) {
  const raw = getString(row, 'dateTime', 'date_time', 'createdAt', 'created_at');
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function analyticsStatsFallback(req: Request): Promise<NextResponse> {
  const token = getBearer(req);
  if (!token) return supabaseError('Missing bearer token', 401);

  try {
    await resolveSupabaseUser(token);
    const supabase = dbClient(token);
    const table = await findReadableTable(supabase);
    const { data, error } = await supabase.from(table).select('*').limit(5000);
    if (error) throw new Error(error.message);

    const stats: DashboardStats = emptyDashboardStats();
    const rows = (data ?? []) as Record<string, unknown>[];
    stats.totalCrimes = rows.length;

    const areaMap = new Map<string, { count: number; severities: Map<Severity, number> }>();
    const trendMap = new Map<string, number>();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const row of rows) {
      const type = validEnum(CrimeType, getString(row, 'type', 'crime_type'), CrimeType.OTHER) as CrimeType;
      const severity = validEnum(
        Severity,
        getString(row, 'severity', 'risk_level'),
        Severity.MEDIUM
      ) as Severity;
      stats.crimesByType[type] += 1;
      stats.crimesBySeverity[severity] += 1;

      const area = getString(row, 'area', 'neighborhood', 'thana');
      if (area) {
        const current = areaMap.get(area) ?? { count: 0, severities: new Map<Severity, number>() };
        current.count += 1;
        current.severities.set(severity, (current.severities.get(severity) ?? 0) + 1);
        areaMap.set(area, current);
      }

      const date = getDate(row);
      if (date.getTime() >= cutoff) {
        const key = date.toISOString().slice(0, 10);
        trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
      }
    }

    stats.crimesByArea = Array.from(areaMap.entries())
      .map(([area, value]) => ({
        area,
        count: value.count,
        riskLevel:
          Array.from(value.severities.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          Severity.LOW,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    stats.trends = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load analytics';
    return supabaseError(message, message.includes('token') ? 401 : 500);
  }
}
