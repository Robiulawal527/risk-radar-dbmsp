import { SOSStatus, type SOSRequest } from '@risk-radar/types';
import { supabase, isSupabaseConfigured } from './supabase';

export type SosAlertRow = Record<string, unknown>;

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type CreateSosAlertInput = {
  coordinates: Coordinates;
  message?: string;
};

export const SOS_ALERT_TABLES = ['sos_alerts', 'SOSRequest', 'sos_requests', 'sos'] as const;

function getString(row: SosAlertRow, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

function getNumber(row: SosAlertRow, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function getDate(row: SosAlertRow, ...keys: string[]): Date {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function normalizeStatus(value?: string): SOSStatus {
  const upper = value?.toUpperCase();
  if (upper === SOSStatus.RESOLVED) return SOSStatus.RESOLVED;
  if (upper === SOSStatus.CANCELLED) return SOSStatus.CANCELLED;
  return SOSStatus.ACTIVE;
}

export function mapSosAlertRow(row: SosAlertRow): SOSRequest | null {
  const id = getString(row, 'id');
  const latitude = getNumber(row, 'latitude', 'lat');
  const longitude = getNumber(row, 'longitude', 'lng', 'lon');
  if (!id || latitude === undefined || longitude === undefined) return null;

  return {
    id,
    userId: getString(row, 'user_id', 'userId') ?? 'unknown',
    status: normalizeStatus(getString(row, 'status')),
    location: {
      latitude,
      longitude,
      accuracy: getNumber(row, 'accuracy'),
      address: getString(row, 'address'),
      area: getString(row, 'area'),
      district: getString(row, 'district'),
      division: getString(row, 'division'),
    },
    message: getString(row, 'message') ?? 'Emergency assistance requested',
    createdAt: getDate(row, 'created_at', 'createdAt'),
    resolvedAt: row.resolved_at || row.resolvedAt ? getDate(row, 'resolved_at', 'resolvedAt') : undefined,
  };
}

async function readableSosTable(): Promise<string> {
  for (const table of SOS_ALERT_TABLES) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) return table;
  }
  return 'sos_alerts';
}

function createPayloads(userId: string, input: CreateSosAlertInput): SosAlertRow[] {
  const now = new Date().toISOString();
  const message = input.message ?? 'Emergency assistance requested';
  return [
    {
      user_id: userId,
      status: SOSStatus.ACTIVE,
      latitude: input.coordinates.latitude,
      longitude: input.coordinates.longitude,
      message,
      created_at: now,
    },
    {
      userId,
      status: SOSStatus.ACTIVE,
      latitude: input.coordinates.latitude,
      longitude: input.coordinates.longitude,
      address: `${input.coordinates.latitude.toFixed(5)}, ${input.coordinates.longitude.toFixed(5)}`,
      area: 'GPS fix',
      message,
      contacts: [],
      createdAt: now,
    },
  ];
}

export async function createSosAlertInSupabase(input: CreateSosAlertInput): Promise<SOSRequest | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  let lastError: unknown;
  for (const table of SOS_ALERT_TABLES) {
    for (const payload of createPayloads(userId, input)) {
      const { data, error } = await supabase.from(table).insert(payload as never).select('*').maybeSingle();
      if (!error) return mapSosAlertRow((data ?? payload) as SosAlertRow);

      const fallback = await supabase.from(table).insert(payload as never);
      if (!fallback.error) return mapSosAlertRow({ ...payload, id: `local-${Date.now()}` });
      lastError = fallback.error ?? error;
    }

    const message =
      lastError && typeof lastError === 'object' && 'message' in lastError
        ? String((lastError as { message?: string }).message).toLowerCase()
        : '';
    if (!message.includes('relation') && !message.includes('table') && !message.includes('does not exist')) break;
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Could not create SOS alert in Supabase.');
}

export async function fetchMySosAlertsFromSupabase(limit = 50): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const table = await readableSosTable();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(table === 'SOSRequest' ? 'userId' : 'user_id', userId)
    .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as SosAlertRow[]).map(mapSosAlertRow).filter((alert): alert is SOSRequest => Boolean(alert));
}

export async function fetchActiveSosAlertsFromSupabase(limit = 200): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const table = await readableSosTable();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as SosAlertRow[])
    .map(mapSosAlertRow)
    .filter((alert): alert is SOSRequest => alert !== null && alert.status === SOSStatus.ACTIVE);
}
