import { SOSStatus, type SOSRequest } from '@/lib/types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

type SosRow = Record<string, unknown>;

export const SOS_ALERT_TABLES = ['sos_alerts', 'SOSRequest', 'sos_requests', 'sos'] as const;

/** Reads the first non-empty string field from mixed snake_case/camelCase SOS rows. */
function str(row: SosRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

/** Reads and validates numeric coordinate fields so malformed rows are not rendered on maps. */
function num(row: SosRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Converts database date-like fields into Date values for consistent UI sorting and formatting. */
function date(row: SosRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Normalizes raw database status text into the shared SOSStatus enum. */
function status(value?: string): SOSStatus {
  const upper = value?.toUpperCase();
  if (upper === SOSStatus.RESOLVED) return SOSStatus.RESOLVED;
  if (upper === SOSStatus.CANCELLED) return SOSStatus.CANCELLED;
  return SOSStatus.ACTIVE;
}

/** Maps any supported SOS table row into the web SOSRequest shape, returning null for unusable rows. */
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

/** Generates a UUID for deployments whose SOS id is UUID and lacks a database default. */
function uuidV4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const next = char === 'x' ? value : (value & 0x3) | 0x8;
    return next.toString(16);
  });
}

/** Removes undefined keys while preserving null values that intentionally clear resolved timestamps. */
function withoutUndefined(payload: SosRow): SosRow {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

/** Tries id-first and id-less inserts to support both UUID/text ids and bigint database defaults. */
function withOptionalUuidId(payload: SosRow, alertId: string): SosRow[] {
  return [withoutUndefined({ id: alertId, ...payload }), withoutUndefined(payload)];
}

/** Builds a bigint-compatible id for the normalized public.sos_alerts compatibility view. */
function numericAlertId(): number {
  return Math.floor(Date.now() * 1000 + Math.random() * 1000);
}

/** Extracts a plain Supabase error message from unknown error shapes. */
function supabaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return error instanceof Error ? error.message : '';
}

/** Detects missing-table errors so the helper can try the next supported SOS table name. */
function isMissingTableError(message: string): boolean {
  return /relation .* does not exist|table .* does not exist|could not find the table|does not exist/i.test(
    message
  );
}

/** Detects schema-shape errors so the helper can retry a lighter payload or another legacy table. */
function isRetryablePayloadError(message: string): boolean {
  return /schema cache|column .* does not exist|could not find .* column|invalid input syntax for type bigint|null value in column "id"|violates not-null constraint/i.test(
    message
  );
}

/** Detects RLS/JWT failures and reports an actionable login or policy issue. */
function isAuthPolicyError(message: string): boolean {
  return /row-level security|permission denied|jwt|token|unauthorized|not authenticated|42501/i.test(message);
}

/** Builds deduplicated insert payloads for public.sos_alerts and the legacy camelCase table. */
function createPayloads(params: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  message?: string;
}) {
  const now = new Date().toISOString();
  const message = params.message ?? 'Emergency assistance requested';
  const alertId = uuidV4();
  const publicAlertId = numericAlertId();
  const publicSos = withoutUndefined({
    user_id: params.userId,
    status: SOSStatus.ACTIVE,
    latitude: params.latitude,
    longitude: params.longitude,
    message,
    created_at: now,
  });
  const publicWithLocation = withoutUndefined({
    user_id: params.userId,
    status: SOSStatus.ACTIVE,
    latitude: params.latitude,
    longitude: params.longitude,
    address: `${params.latitude.toFixed(5)}, ${params.longitude.toFixed(5)}`,
    area: 'GPS fix',
    message,
    created_at: now,
  });
  const appSchema = withoutUndefined({
    userId: params.userId,
    status: SOSStatus.ACTIVE,
    latitude: params.latitude,
    longitude: params.longitude,
    address: `${params.latitude.toFixed(5)}, ${params.longitude.toFixed(5)}`,
    area: 'GPS fix',
    message,
    contacts: [],
    createdAt: now,
  });
  const attempts = [
    withoutUndefined({ id: publicAlertId, ...publicSos }),
    ...withOptionalUuidId(publicSos, alertId),
    withoutUndefined({ id: publicAlertId, ...publicWithLocation }),
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

/** Creates status update payloads for public.sos_alerts and legacy SOSRequest rows. */
function updateStatusPayloads(table: string, nextStatus: SOSStatus): SosRow[] {
  const now = new Date().toISOString();
  const resolvedValue = nextStatus === SOSStatus.ACTIVE ? null : now;
  const attempts =
    table === 'SOSRequest'
      ? [{ status: nextStatus, resolvedAt: resolvedValue }, { status: nextStatus }]
      : [
          { status: nextStatus, resolved_at: resolvedValue, updated_at: now },
          { status: nextStatus, resolved_at: resolvedValue },
          { status: nextStatus },
        ];
  const seen = new Set<string>();
  return attempts.map(withoutUndefined).filter((payload) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Sorts and deduplicates SOS rows gathered from multiple supported table names. */
function normalizeSosList(rows: SosRow[], limit: number, activeOnly = false): SOSRequest[] {
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

/** Fetches active SOS alerts for maps; final filtering protects against mixed-case legacy status values. */
export async function fetchActiveSosAlertsFromSupabase(limit = 200): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const rows: SosRow[] = [];
  let lastError: unknown;
  let foundReadableTable = false;

  for (const table of SOS_ALERT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      foundReadableTable = true;
      rows.push(...((data ?? []) as SosRow[]));
      continue;
    }

    const msg = supabaseErrorMessage(error).toLowerCase();
    lastError = error;
    if (!isMissingTableError(msg) && !isRetryablePayloadError(msg)) break;
  }

  if (foundReadableTable) return normalizeSosList(rows, limit, true);
  if (lastError instanceof Error) throw lastError;
  return [];
}

/** Fetches a user's SOS history from whichever SOS table is readable in this deployment. */
export async function fetchMySosAlertsFromSupabase(userId: string, limit = 50): Promise<SOSRequest[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const rows: SosRow[] = [];
  let lastError: unknown;
  let foundReadableTable = false;

  for (const table of SOS_ALERT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(table === 'SOSRequest' ? 'userId' : 'user_id', userId)
      .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      foundReadableTable = true;
      rows.push(...((data ?? []) as SosRow[]));
      continue;
    }

    const msg = supabaseErrorMessage(error).toLowerCase();
    lastError = error;
    if (!isMissingTableError(msg) && !isRetryablePayloadError(msg)) break;
  }

  if (foundReadableTable) return normalizeSosList(rows, limit);
  if (lastError instanceof Error) throw lastError;
  return [];
}

/** Creates a live SOS alert directly in Supabase, trying compatible schemas before throwing the final error. */
export async function createSosAlertInSupabase(params: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  message?: string;
}): Promise<SOSRequest | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  let lastError: unknown;
  for (const table of SOS_ALERT_TABLES) {
    for (const payload of createPayloads(params)) {
      const { error } = await supabase.from(table).insert(payload as never);
      if (!error) {
        return mapSosAlertRow({
          ...payload,
          id: str(payload, 'id') ?? `local-${Date.now()}`,
        });
      }

      const msg = supabaseErrorMessage(error).toLowerCase();
      lastError = error;

      if (isAuthPolicyError(msg)) {
        throw new Error(
          'Your login session is not authorized to send SOS alerts. Sign out, sign back in, and try again. If it still fails, apply the Supabase RLS policy for authenticated SOS inserts.'
        );
      }

      if (!isRetryablePayloadError(msg)) break;
    }

    if (!lastError) continue;
    const msg = supabaseErrorMessage(lastError).toLowerCase();
    if (!isMissingTableError(msg) && !isRetryablePayloadError(msg)) break;
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('Could not create SOS alert in Supabase.');
}

/** Resolves a user's SOS alert so it disappears from active maps without destroying the history row. */
export async function resolveSosAlertInSupabase(id: string, userId: string): Promise<SOSRequest | null> {
  const supabase = getSupabaseBrowserClient();
  const alertId = id.trim();
  if (!supabase || !alertId || alertId.startsWith('local-')) return null;

  let lastError: unknown;
  for (const table of SOS_ALERT_TABLES) {
    const ownerColumn = table === 'SOSRequest' ? 'userId' : 'user_id';

    for (const payload of updateStatusPayloads(table, SOSStatus.RESOLVED)) {
      const { data, error } = await supabase
        .from(table)
        .update(payload as never)
        .eq('id', alertId)
        .eq(ownerColumn, userId)
        .select('*')
        .maybeSingle();

      if (!error && data) return mapSosAlertRow(data as SosRow);
      if (!error && !data) continue;

      const msg = supabaseErrorMessage(error).toLowerCase();
      lastError = error;

      if (isAuthPolicyError(msg)) {
        throw new Error(
          'Your login session is not authorized to resolve this SOS. Sign out, sign back in, and try again. If it still fails, apply the Supabase RLS policy for authenticated SOS updates.'
        );
      }

      if (!isRetryablePayloadError(msg)) break;
    }

    if (!lastError) continue;
    const msg = supabaseErrorMessage(lastError).toLowerCase();
    if (!isMissingTableError(msg) && !isRetryablePayloadError(msg)) break;
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('SOS alert was not found or is already unavailable.');
}
