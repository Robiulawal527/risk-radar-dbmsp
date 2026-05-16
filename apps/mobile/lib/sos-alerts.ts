import { SOSStatus, type SOSRequest } from '@risk-radar/types';
import { supabase, supabaseWithAccessToken, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '@/store/auth';

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
type SosAuth = {
  userId: string;
  accessToken: string;
};

/** Reads the first non-empty string field from mixed snake_case/camelCase SOS rows. */
function getString(row: SosAlertRow, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

/** Reads and validates numeric coordinate fields so malformed realtime rows are ignored safely. */
function getNumber(row: SosAlertRow, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

/** Converts a database date-like field into a Date while falling back to now for legacy rows. */
function getDate(row: SosAlertRow, ...keys: string[]): Date {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

/** Normalizes raw status text into the shared SOSStatus enum used by UI filters and badges. */
function normalizeStatus(value?: string): SOSStatus {
  const upper = value?.toUpperCase();
  if (upper === SOSStatus.RESOLVED) return SOSStatus.RESOLVED;
  if (upper === SOSStatus.CANCELLED) return SOSStatus.CANCELLED;
  return SOSStatus.ACTIVE;
}

/** Maps any supported SOS table shape into the app's SOSRequest model, returning null for unusable rows. */
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

/** Generates a client-side UUID for schemas where the id column is UUID and has no database default. */
function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const next = char === 'x' ? value : (value & 0x3) | 0x8;
    return next.toString(16);
  });
}

/** Removes undefined keys without removing null, letting updates intentionally clear resolvedAt when needed. */
function withoutUndefined(payload: SosAlertRow): SosAlertRow {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

/** Tries id-first and id-less payloads to support both UUID/text ids and bigint defaults. */
function withOptionalUuidId(payload: SosAlertRow, alertId: string): SosAlertRow[] {
  return [withoutUndefined({ id: alertId, ...payload }), withoutUndefined(payload)];
}

/** Builds deduplicated insert payloads for public.sos_alerts and legacy SOSRequest schemas. */
function createPayloads(userId: string, input: CreateSosAlertInput): SosAlertRow[] {
  const now = new Date().toISOString();
  const message = input.message ?? 'Emergency assistance requested';
  const alertId = uuidV4();
  const publicSos = withoutUndefined({
    user_id: userId,
    status: SOSStatus.ACTIVE,
    latitude: input.coordinates.latitude,
    longitude: input.coordinates.longitude,
    message,
    created_at: now,
  });
  const publicWithLocation = withoutUndefined({
    user_id: userId,
    status: SOSStatus.ACTIVE,
    latitude: input.coordinates.latitude,
    longitude: input.coordinates.longitude,
    address: `${input.coordinates.latitude.toFixed(5)}, ${input.coordinates.longitude.toFixed(5)}`,
    area: 'GPS fix',
    message,
    created_at: now,
  });
  const appSchema = withoutUndefined({
    userId,
    status: SOSStatus.ACTIVE,
    latitude: input.coordinates.latitude,
    longitude: input.coordinates.longitude,
    address: `${input.coordinates.latitude.toFixed(5)}, ${input.coordinates.longitude.toFixed(5)}`,
    area: 'GPS fix',
    message,
    contacts: [],
    createdAt: now,
  });
  const attempts = [
    ...withOptionalUuidId(publicSos, alertId),
    ...withOptionalUuidId(publicWithLocation, alertId),
    ...withOptionalUuidId(appSchema, alertId),
  ];
  const seen = new Set<string>();
  return attempts.filter((payload) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Extracts a plain Supabase error message from several error object shapes. */
function supabaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return error instanceof Error ? error.message : '';
}

/** Detects table-name failures so the helper can try the next known SOS table. */
function isMissingTableError(message: string): boolean {
  return /relation .* does not exist|table .* does not exist|could not find the table|does not exist/i.test(
    message
  );
}

/** Detects schema-shape failures so the helper can retry a lighter payload or another table. */
function isRetryablePayloadError(message: string): boolean {
  return /schema cache|column .* does not exist|could not find .* column|invalid input syntax for type bigint|null value in column "id"|violates not-null constraint/i.test(
    message
  );
}

/** Detects RLS/JWT failures and turns them into actionable login or policy guidance. */
function isAuthPolicyError(message: string): boolean {
  return /row-level security|permission denied|jwt|token|unauthorized|not authenticated|42501/i.test(message);
}

/** Resolves auth from the Supabase session first, then the hydrated Zustand token used after app startup. */
async function getSosAuth(): Promise<SosAuth | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user?.id && data.session.access_token) {
    return { userId: data.session.user.id, accessToken: data.session.access_token };
  }

  const state = useAuthStore.getState();
  if (state.user?.id && state.accessToken) {
    return { userId: state.user.id, accessToken: state.accessToken };
  }

  return null;
}

/** Inserts an active SOS through the authenticated Supabase client, trying compatible payloads until one fits. */
async function insertSosIntoSupabase(input: CreateSosAlertInput, auth: SosAuth): Promise<SOSRequest | null> {
  const authedSupabase = supabaseWithAccessToken(auth.accessToken);
  let lastError: unknown;

  for (const table of SOS_ALERT_TABLES) {
    for (const payload of createPayloads(auth.userId, input)) {
      const { error } = await authedSupabase.from(table).insert(payload as never);

      if (!error) {
        return mapSosAlertRow({
          ...payload,
          id: getString(payload, 'id') ?? `local-${Date.now()}`,
        });
      }

      const message = supabaseErrorMessage(error).toLowerCase();
      lastError = error;

      if (isAuthPolicyError(message)) {
        throw new Error(
          'Your login session is not authorized to send SOS alerts. Sign out, sign back in, and try again. If it still fails, apply the Supabase RLS policy for authenticated SOS inserts.'
        );
      }

      if (!isRetryablePayloadError(message)) break;
    }

    if (!lastError) continue;

    const message = supabaseErrorMessage(lastError).toLowerCase();
    if (!isMissingTableError(message)) break;
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Could not create SOS alert in Supabase.');
}

/** Creates a live SOS alert directly in Supabase when configured, otherwise lets the caller fall back to the API. */
export async function createSosAlertInSupabase(input: CreateSosAlertInput): Promise<SOSRequest | null> {
  if (!isSupabaseConfigured()) return null;
  const auth = await getSosAuth();
  if (!auth) return null;
  return insertSosIntoSupabase(input, auth);
}

/** Creates status update payloads that support both public.sos_alerts and legacy camelCase SOSRequest rows. */
function updateStatusPayloads(table: string, status: SOSStatus): SosAlertRow[] {
  const now = new Date().toISOString();
  const resolvedValue = status === SOSStatus.ACTIVE ? null : now;
  const attempts =
    table === 'SOSRequest'
      ? [{ status, resolvedAt: resolvedValue }, { status }]
      : [
          { status, resolved_at: resolvedValue, updated_at: now },
          { status, resolved_at: resolvedValue },
          { status },
        ];

  const seen = new Set<string>();
  return attempts.map(withoutUndefined).filter((payload) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Updates one owned SOS row status; resolving acts as the app's safe delete because active feeds filter it out. */
async function updateSosStatusInSupabase(id: string, status: SOSStatus, auth: SosAuth): Promise<SOSRequest | null> {
  const alertId = id.trim();
  if (!alertId || alertId.startsWith('local-')) return null;

  const authedSupabase = supabaseWithAccessToken(auth.accessToken);
  let lastError: unknown;

  for (const table of SOS_ALERT_TABLES) {
    const ownerColumn = table === 'SOSRequest' ? 'userId' : 'user_id';

    for (const payload of updateStatusPayloads(table, status)) {
      const { data, error } = await authedSupabase
        .from(table)
        .update(payload as never)
        .eq('id', alertId)
        .eq(ownerColumn, auth.userId)
        .select('*')
        .maybeSingle();

      if (!error && data) return mapSosAlertRow(data as SosAlertRow);
      if (!error && !data) continue;

      const message = supabaseErrorMessage(error).toLowerCase();
      lastError = error;

      if (isAuthPolicyError(message)) {
        throw new Error(
          'Your login session is not authorized to resolve this SOS. Sign out, sign back in, and try again. If it still fails, apply the Supabase RLS policy for authenticated SOS updates.'
        );
      }

      if (!isRetryablePayloadError(message)) break;
    }

    if (!lastError) continue;

    const message = supabaseErrorMessage(lastError).toLowerCase();
    if (!isMissingTableError(message) && !isRetryablePayloadError(message)) break;
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('SOS alert was not found or is already unavailable.');
}

/** Resolves a user's SOS alert so it disappears from live maps and nearby alert feeds without deleting history. */
export async function resolveSosAlertInSupabase(id: string): Promise<SOSRequest | null> {
  if (!isSupabaseConfigured()) return null;
  const auth = await getSosAuth();
  if (!auth) return null;
  return updateSosStatusInSupabase(id, SOSStatus.RESOLVED, auth);
}

/** Sorts and deduplicates SOS rows gathered from multiple legacy table names. */
function normalizeSosList(rows: SosAlertRow[], limit: number, activeOnly = false): SOSRequest[] {
  const byId = new Map<string, SOSRequest>();
  for (const row of rows) {
    const alert = mapSosAlertRow(row);
    if (!alert) continue;
    if (activeOnly && alert.status !== SOSStatus.ACTIVE) continue;
    byId.set(alert.id, alert);
  }
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/** Fetches the current user's SOS history with auth headers so RLS-protected rows load after app hydration. */
export async function fetchMySosAlertsFromSupabase(limit = 50): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const auth = await getSosAuth();
  if (!auth) return [];

  const authedSupabase = supabaseWithAccessToken(auth.accessToken);
  const rows: SosAlertRow[] = [];
  let lastError: unknown;
  let foundReadableTable = false;

  for (const table of SOS_ALERT_TABLES) {
    const { data, error } = await authedSupabase
      .from(table)
      .select('*')
      .eq(table === 'SOSRequest' ? 'userId' : 'user_id', auth.userId)
      .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      foundReadableTable = true;
      rows.push(...((data ?? []) as SosAlertRow[]));
      continue;
    }

    const message = supabaseErrorMessage(error).toLowerCase();
    lastError = error;
    if (!isMissingTableError(message) && !isRetryablePayloadError(message)) break;
  }

  if (foundReadableTable) return normalizeSosList(rows, limit);
  if (lastError instanceof Error) throw lastError;
  return [];
}

/** Fetches active SOS alerts for maps; final filtering stays client-side to support mixed legacy status values. */
export async function fetchActiveSosAlertsFromSupabase(limit = 200): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const auth = await getSosAuth();
  const client = auth ? supabaseWithAccessToken(auth.accessToken) : supabase;
  const rows: SosAlertRow[] = [];
  let lastError: unknown;
  let foundReadableTable = false;

  for (const table of SOS_ALERT_TABLES) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      foundReadableTable = true;
      rows.push(...((data ?? []) as SosAlertRow[]));
      continue;
    }

    const message = supabaseErrorMessage(error).toLowerCase();
    lastError = error;
    if (!isMissingTableError(message) && !isRetryablePayloadError(message)) break;
  }

  if (foundReadableTable) return normalizeSosList(rows, limit, true);
  if (lastError instanceof Error) throw lastError;
  return [];
}
