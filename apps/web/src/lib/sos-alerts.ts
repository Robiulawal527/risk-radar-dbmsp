import { SOSStatus, type SOSRequest } from '@/lib/types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type SosRow = Record<string, unknown>;

export const SOS_ALERT_TABLES = ['sos_alerts', 'SOSRequest', 'sos_requests', 'sos'] as const;

function str(row: SosRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

function num(row: SosRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function date(row: SosRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function status(value?: string): SOSStatus {
  const upper = value?.toUpperCase();
  if (upper === SOSStatus.RESOLVED) return SOSStatus.RESOLVED;
  if (upper === SOSStatus.CANCELLED) return SOSStatus.CANCELLED;
  return SOSStatus.ACTIVE;
}

export function mapSosAlertRow(row: SosRow): SOSRequest | null {
  const id = str(row, 'id');
  const latitude = num(row, 'latitude', 'lat');
  const longitude = num(row, 'longitude', 'lng', 'lon');
  if (!id || latitude === undefined || longitude === undefined) return null;

  return {
    id,
    userId: str(row, 'user_id', 'userId') ?? 'unknown',
    status: status(str(row, 'status')),
    location: {
      latitude,
      longitude,
      accuracy: num(row, 'accuracy'),
      address: str(row, 'address'),
      area: str(row, 'area'),
      district: str(row, 'district'),
      division: str(row, 'division'),
    },
    message: str(row, 'message') ?? 'Emergency assistance requested',
    createdAt: date(row, 'created_at', 'createdAt'),
    resolvedAt: row.resolved_at || row.resolvedAt ? date(row, 'resolved_at', 'resolvedAt') : undefined,
  };
}

async function readableTable() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  for (const table of SOS_ALERT_TABLES) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) return table;
  }
  return 'sos_alerts';
}

export async function fetchActiveSosAlertsFromSupabase(limit = 200): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const table = await readableTable();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SosRow[])
    .map(mapSosAlertRow)
    .filter((alert): alert is SOSRequest => alert !== null && alert.status === SOSStatus.ACTIVE);
}

export async function fetchMySosAlertsFromSupabase(userId: string, limit = 50): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const table = await readableTable();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(table === 'SOSRequest' ? 'userId' : 'user_id', userId)
    .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SosRow[]).map(mapSosAlertRow).filter((alert): alert is SOSRequest => Boolean(alert));
}

export async function createSosAlertInSupabase(params: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  message?: string;
}): Promise<SOSRequest | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const now = new Date().toISOString();
  const message = params.message ?? 'Emergency assistance requested';
  const payloads: SosRow[] = [
    {
      user_id: params.userId,
      status: SOSStatus.ACTIVE,
      latitude: params.latitude,
      longitude: params.longitude,
      message,
      created_at: now,
    },
    {
      userId: params.userId,
      status: SOSStatus.ACTIVE,
      latitude: params.latitude,
      longitude: params.longitude,
      address: `${params.latitude.toFixed(5)}, ${params.longitude.toFixed(5)}`,
      area: 'GPS fix',
      message,
      contacts: [],
      createdAt: now,
    },
  ];

  let lastError: unknown;
  for (const table of SOS_ALERT_TABLES) {
    for (const payload of payloads) {
      const { data, error } = await supabase.from(table).insert(payload as never).select('*').maybeSingle();
      if (!error) return mapSosAlertRow((data ?? payload) as SosRow);
      const fallback = await supabase.from(table).insert(payload as never);
      if (!fallback.error) return mapSosAlertRow({ ...payload, id: `local-${Date.now()}` });
      lastError = fallback.error ?? error;
    }
    const msg =
      lastError && typeof lastError === 'object' && 'message' in lastError
        ? String((lastError as { message?: string }).message).toLowerCase()
        : '';
    if (!msg.includes('relation') && !msg.includes('table') && !msg.includes('does not exist')) break;
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('Could not create SOS alert in Supabase.');
}
