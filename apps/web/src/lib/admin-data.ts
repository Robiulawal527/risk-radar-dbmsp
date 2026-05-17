import {
  CrimeType,
  Severity,
  SOSStatus,
  type Crime,
  type CriminalRanking,
  type PhilanthropistRanking,
  type SOSRequest,
} from '@/lib/types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { mapCrimeRowLoose } from '@/lib/map-crimes';
import { mapSosAlertRow, SOS_ALERT_TABLES } from '@/lib/sos-alerts';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

export type AdminCriminalRecord = {
  id: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  description: string;
  knownAliases: string[];
  photoUrl?: string | null;
  status: string;
  crimeCount: number;
  intensity: number;
  mostFrequentCrime: CrimeType;
  score: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminVolunteer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  skills: string[];
  status: string;
  activityCount: number;
  intensity: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCrimeInput = {
  id?: string;
  type: CrimeType;
  category?: CrimeType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  district?: string;
  division?: string;
  severity: Severity;
  status: string;
  reportedBy: string;
  dateTime?: string;
};

export type CriminalRecordInput = {
  id?: string;
  name: string;
  age?: number | null;
  gender?: string;
  description: string;
  knownAliases: string[];
  photoUrl?: string;
  status: string;
  crimeCount: number;
  intensity: number;
  mostFrequentCrime: CrimeType;
};

export type VolunteerInput = {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  skills: string[];
  status: string;
  activityCount: number;
  intensity: number;
};

const CRIME_TABLES = ['crimes', 'Crime', 'crime', 'incidents'] as const;
const CRIMINAL_TABLES = ['criminal_records', 'CriminalRecord'] as const;
const VOLUNTEER_TABLES = ['volunteers', 'Volunteer'] as const;

function assertSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Supabase client is unavailable.');
  return supabase;
}

function nowIso() {
  return new Date().toISOString();
}

function str(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

function num(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function arr(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function date(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function asCrimeType(value?: string): CrimeType {
  return value && (Object.values(CrimeType) as string[]).includes(value)
    ? (value as CrimeType)
    : CrimeType.OTHER;
}

function asSeverity(value?: string): Severity {
  return value && (Object.values(Severity) as string[]).includes(value)
    ? (value as Severity)
    : Severity.LOW;
}

function isMissingOrShapeError(message: string) {
  return /relation .* does not exist|table .* does not exist|could not find the table|schema cache|column .* does not exist|could not find .* column|does not exist/i.test(
    message
  );
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message?: unknown }).message ?? '');
  return error instanceof Error ? error.message : String(error ?? '');
}

async function detectReadableTable(supabase: SupabaseClient, candidates: readonly string[]) {
  let lastError = '';
  for (const table of candidates) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) return table;
    lastError = errorMessage(error);
    if (!isMissingOrShapeError(lastError)) break;
  }
  throw new Error(lastError || `No readable table found. Tried: ${candidates.join(', ')}`);
}

function normalizeCriminal(row: Row): AdminCriminalRecord {
  const crimeCount = num(row, 'crime_count', 'crimeCount') ?? 0;
  const intensity = num(row, 'intensity', 'severity_weight') ?? 1;
  return {
    id: str(row, 'id') ?? crypto.randomUUID(),
    name: str(row, 'name') ?? 'Unknown person',
    age: num(row, 'age'),
    gender: str(row, 'gender'),
    description: str(row, 'description') ?? '',
    knownAliases: arr(row, 'known_aliases', 'knownAliases'),
    photoUrl: str(row, 'photo_url', 'photoUrl'),
    status: str(row, 'status') ?? 'UNDER_REVIEW',
    crimeCount,
    intensity,
    mostFrequentCrime: asCrimeType(str(row, 'most_frequent_crime', 'mostFrequentCrime')),
    score: Math.round((num(row, 'score') ?? crimeCount * intensity * 10) * 10) / 10,
    createdAt: date(row, 'created_at', 'createdAt'),
    updatedAt: date(row, 'updated_at', 'updatedAt'),
  };
}

function normalizeVolunteer(row: Row): AdminVolunteer {
  const activityCount = num(row, 'activity_count', 'activityCount', 'reports_submitted') ?? 0;
  const intensity = num(row, 'intensity', 'impact_score', 'accuracy') ?? 1;
  return {
    id: str(row, 'id', 'user_id', 'userId') ?? crypto.randomUUID(),
    name: str(row, 'name', 'full_name') ?? 'Volunteer',
    email: str(row, 'email'),
    phone: str(row, 'phone'),
    avatar: str(row, 'avatar'),
    skills: arr(row, 'skills'),
    status: str(row, 'status') ?? 'ACTIVE',
    activityCount,
    intensity,
    score: Math.round((num(row, 'score') ?? activityCount * intensity * 10) * 10) / 10,
    createdAt: date(row, 'created_at', 'createdAt'),
    updatedAt: date(row, 'updated_at', 'updatedAt'),
  };
}

function crimePayload(table: string, input: AdminCrimeInput): Row {
  const base = {
    type: input.type,
    category: input.category ?? input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address?.trim() || null,
    area: input.area?.trim() || null,
    district: input.district?.trim() || null,
    division: input.division?.trim() || null,
    severity: input.severity,
    status: input.status.trim() || 'REPORTED',
  };
  if (table === 'Crime') {
    return {
      ...base,
      reportedBy: input.reportedBy.trim() || 'Admin',
      userId: 'admin',
      victimInfo: {},
      criminalInfo: [],
      witnesses: [],
      dateTime: input.dateTime ?? nowIso(),
      updatedAt: nowIso(),
    };
  }
  return {
    ...base,
    reported_by: input.reportedBy.trim() || 'Admin',
    date_time: input.dateTime ?? nowIso(),
    updated_at: nowIso(),
  };
}

function criminalPayload(table: string, input: CriminalRecordInput): Row {
  const score =
    Math.round(Math.max(0, input.crimeCount) * Math.max(0, input.intensity) * 10 * 10) / 10;
  if (table === 'CriminalRecord') {
    return {
      name: input.name.trim(),
      age: input.age || null,
      gender: input.gender?.trim() || null,
      description: input.description.trim(),
      knownAliases: input.knownAliases,
      photoUrl: input.photoUrl?.trim() || null,
      status: input.status.trim() || 'UNDER_REVIEW',
      crimeCount: input.crimeCount,
      updatedAt: nowIso(),
    };
  }
  return {
    name: input.name.trim(),
    age: input.age || null,
    gender: input.gender?.trim() || null,
    description: input.description.trim(),
    known_aliases: input.knownAliases,
    photo_url: input.photoUrl?.trim() || null,
    status: input.status.trim() || 'UNDER_REVIEW',
    crime_count: input.crimeCount,
    intensity: input.intensity,
    most_frequent_crime: input.mostFrequentCrime,
    score,
    updated_at: nowIso(),
  };
}

function volunteerPayload(input: VolunteerInput): Row {
  const score =
    Math.round(Math.max(0, input.activityCount) * Math.max(0, input.intensity) * 10 * 10) / 10;
  return {
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    avatar: input.avatar?.trim() || null,
    skills: input.skills,
    status: input.status.trim() || 'ACTIVE',
    activity_count: input.activityCount,
    intensity: input.intensity,
    score,
    updated_at: nowIso(),
  };
}

export async function fetchAdminCrimes(limit = 100): Promise<Crime[]> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, CRIME_TABLES);
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(table === 'Crime' ? 'createdAt' : 'created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .map(mapCrimeRowLoose)
    .filter((crime): crime is Crime => Boolean(crime));
}

export async function saveAdminCrime(input: AdminCrimeInput): Promise<void> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, CRIME_TABLES);
  const payload = crimePayload(table, input);
  const query = input.id
    ? supabase
        .from(table)
        .update(payload as never)
        .eq('id', input.id)
    : supabase.from(table).insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteAdminCrime(id: string): Promise<void> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, CRIME_TABLES);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchAdminSos(limit = 100): Promise<SOSRequest[]> {
  const supabase = assertSupabase();
  const rows: SOSRequest[] = [];
  for (const table of SOS_ALERT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
      .limit(limit);
    if (error) {
      const msg = error.message.toLowerCase();
      if (isMissingOrShapeError(msg)) continue;
      throw new Error(error.message);
    }
    rows.push(
      ...((data ?? []) as Row[])
        .map(mapSosAlertRow)
        .filter((alert): alert is SOSRequest => Boolean(alert))
    );
  }
  return Array.from(new Map(rows.map((alert) => [alert.id, alert])).values()).slice(0, limit);
}

export async function updateAdminSosStatus(id: string, status: SOSStatus): Promise<void> {
  const supabase = assertSupabase();
  let lastError = '';
  for (const table of SOS_ALERT_TABLES) {
    const payload =
      table === 'SOSRequest'
        ? { status, resolvedAt: status === SOSStatus.ACTIVE ? null : nowIso() }
        : {
            status,
            resolved_at: status === SOSStatus.ACTIVE ? null : nowIso(),
            updated_at: nowIso(),
          };
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq('id', id);
    if (!error) return;
    lastError = error.message;
    if (!isMissingOrShapeError(lastError.toLowerCase())) break;
  }
  throw new Error(lastError || 'Could not update SOS status.');
}

export async function fetchCriminalRecords(limit = 100): Promise<AdminCriminalRecord[]> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, CRIMINAL_TABLES);
  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(normalizeCriminal).sort((a, b) => b.score - a.score);
}

export async function saveCriminalRecord(input: CriminalRecordInput): Promise<void> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, CRIMINAL_TABLES);
  const payload = criminalPayload(table, input);
  const query = input.id
    ? supabase
        .from(table)
        .update(payload as never)
        .eq('id', input.id)
    : supabase.from(table).insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteCriminalRecord(id: string): Promise<void> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, CRIMINAL_TABLES);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchVolunteers(limit = 100): Promise<AdminVolunteer[]> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, VOLUNTEER_TABLES);
  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(normalizeVolunteer).sort((a, b) => b.score - a.score);
}

export async function saveVolunteer(input: VolunteerInput): Promise<void> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, VOLUNTEER_TABLES);
  const payload = volunteerPayload(input);
  const query = input.id
    ? supabase
        .from(table)
        .update(payload as never)
        .eq('id', input.id)
    : supabase.from(table).insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteVolunteer(id: string): Promise<void> {
  const supabase = assertSupabase();
  const table = await detectReadableTable(supabase, VOLUNTEER_TABLES);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function buildCriminalRankings(rows: AdminCriminalRecord[]): CriminalRanking[] {
  return rows
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      rank: index + 1,
      criminalInfo: {
        name: row.name,
        age: row.age ?? undefined,
        gender: row.gender ?? undefined,
        description: row.description,
        knownAliases: row.knownAliases,
        photoUrl: row.photoUrl ?? undefined,
        status: row.status,
      },
      crimeCount: row.crimeCount,
      mostFrequentCrime: row.mostFrequentCrime,
      dangerLevel: asSeverity(
        row.score >= 450
          ? 'CRITICAL'
          : row.score >= 240
            ? 'HIGH'
            : row.score >= 90
              ? 'MEDIUM'
              : 'LOW'
      ),
    }));
}

export function buildVolunteerRankings(rows: AdminVolunteer[]): PhilanthropistRanking[] {
  return rows
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      name: row.name,
      avatar: row.avatar ?? undefined,
      reportsSubmitted: row.activityCount,
      accuracy: Math.min(1, Math.max(0, row.intensity / 10)),
      contribution: Math.round(row.score),
    }));
}
