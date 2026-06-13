import {
  CrimeType,
  Severity,
  SOSStatus,
  type Crime,
  type CriminalRanking,
  type PhilanthropistRanking,
  type SOSRequest,
} from '@risk-radar/types';
import { mapCrimeRowLoose } from './map-crimes';
import { mapSosAlertRow, SOS_ALERT_TABLES } from './sos-alerts';
import { isSupabaseConfigured, supabaseWithAccessToken } from './supabase';
import { useAuthStore } from '@/store/auth';

type Row = Record<string, unknown>;

export type AdminApplicant = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  nidNumber?: string | null;
  education?: string | null;
  educationField?: string | null;
  photoUrl?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

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
  description: string;
  knownAliases: string[];
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
  skills: string[];
  status: string;
  activityCount: number;
  intensity: number;
};

const CRIME_TABLES = ['crimes', 'Crime', 'crime', 'incidents'] as const;
const CRIMINAL_TABLES = ['criminal_records', 'public.criminal_records', 'CriminalRecord'] as const;
const VOLUNTEER_TABLES = ['volunteers', 'public.volunteers', 'Volunteer'] as const;
const CRIME_REPORT_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED', 'ACTIVE']);
const CRIMINAL_RECORD_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'WANTED', 'ARRESTED', 'UNKNOWN']);

function nowIso() {
  return new Date().toISOString();
}

function normalizeCrimeReportStatus(value: string) {
  const status = value.trim().toUpperCase();
  if (CRIME_REPORT_STATUSES.has(status)) return status;
  if (status === 'REPORTED' || status === 'UNDER_REVIEW') return 'PENDING';
  return 'PENDING';
}

function normalizeCriminalRecordStatus(value: string) {
  const status = value.trim().toUpperCase();
  return CRIMINAL_RECORD_STATUSES.has(status) ? status : 'UNKNOWN';
}

function getClient() {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const token = useAuthStore.getState().accessToken;
  return supabaseWithAccessToken(token);
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
    const next = Number(value);
    if (Number.isFinite(next)) return next;
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
    const next = new Date(String(value));
    if (!Number.isNaN(next.getTime())) return next;
  }
  return new Date();
}

function asCrimeType(value?: string): CrimeType {
  return value && (Object.values(CrimeType) as string[]).includes(value)
    ? (value as CrimeType)
    : CrimeType.OTHER;
}

function isMissingOrShapeError(message: string) {
  return /relation .* does not exist|table .* does not exist|could not find the table|schema cache|column .* does not exist|could not find .* column|does not exist/i.test(
    message
  );
}

function isPermissionError(message: string) {
  return /row-level security|permission denied|policy|42501|unauthorized|not authorized|insufficient_privilege/i.test(message);
}

async function detectReadableTable(candidates: readonly string[]) {
  const client = getClient();
  let lastError = '';
  for (const table of candidates) {
    const { error } = await client.from(table).select('*').limit(1);
    if (!error) return table;
    lastError = error.message;
    if (!isMissingOrShapeError(lastError.toLowerCase())) break;
  }
  throw new Error(lastError || `No readable table found. Tried: ${candidates.join(', ')}`);
}

function normalizeApplicant(row: Row): AdminApplicant {
  return {
    id: str(row, 'id') ?? '',
    name: str(row, 'name', 'full_name') ?? 'Admin applicant',
    email: str(row, 'email') ?? '',
    phone: str(row, 'phone'),
    nidNumber: str(row, 'nid_number', 'nidNumber'),
    education: str(row, 'education'),
    educationField: str(row, 'education_field', 'educationField'),
    photoUrl: str(row, 'photo_url', 'photoUrl'),
    status: str(row, 'status') ?? 'PENDING',
    createdAt: date(row, 'created_at', 'createdAt'),
    updatedAt: date(row, 'updated_at', 'updatedAt'),
  };
}

function normalizeCriminal(row: Row): AdminCriminalRecord {
  const crimeCount = num(row, 'crime_count', 'crimeCount') ?? 0;
  const intensity = num(row, 'intensity', 'severity_weight') ?? 1;
  return {
    id: str(row, 'id') ?? '',
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
  };
}

function normalizeVolunteer(row: Row): AdminVolunteer {
  const activityCount = num(row, 'activity_count', 'activityCount', 'reports_submitted') ?? 0;
  const intensity = num(row, 'intensity', 'impact_score', 'accuracy') ?? 1;
  return {
    id: str(row, 'id', 'user_id', 'userId') ?? '',
    name: str(row, 'name', 'full_name') ?? 'Volunteer',
    email: str(row, 'email'),
    phone: str(row, 'phone'),
    avatar: str(row, 'avatar'),
    skills: arr(row, 'skills'),
    status: str(row, 'status') ?? 'ACTIVE',
    activityCount,
    intensity,
    score: Math.round((num(row, 'score') ?? activityCount * intensity * 10) * 10) / 10,
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
    status: normalizeCrimeReportStatus(input.status),
  };

  if (table === 'Crime') {
    return {
      ...base,
      reportedBy: input.reportedBy.trim() || 'Admin',
      userId: useAuthStore.getState().user?.id ?? 'admin',
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
      description: input.description.trim(),
      knownAliases: input.knownAliases,
      status: normalizeCriminalRecordStatus(input.status),
      crimeCount: input.crimeCount,
      updatedAt: nowIso(),
    };
  }

  return {
    name: input.name.trim(),
    description: input.description.trim(),
    known_aliases: input.knownAliases,
    status: normalizeCriminalRecordStatus(input.status),
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
    skills: input.skills,
    status: input.status.trim() || 'ACTIVE',
    activity_count: input.activityCount,
    intensity: input.intensity,
    score,
    updated_at: nowIso(),
  };
}

export async function fetchAdminApplicants(limit = 80): Promise<AdminApplicant[]> {
  const client = getClient();
  const { data, error } = await client
    .from('admins')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(normalizeApplicant).filter((row) => row.id);
}

export async function updateAdminApplicantStatus(
  applicant: AdminApplicant,
  status: 'ACTIVE' | 'REJECTED'
) {
  const client = getClient();
  const now = nowIso();
  const { error: adminError } = await client
    .from('admins')
    .update({
      status,
      reviewed_at: now,
      rejection_reason: status === 'ACTIVE' ? null : 'Rejected by mobile admin review',
      updated_at: now,
    } as never)
    .eq('id', applicant.id);
  if (adminError) throw new Error(adminError.message);

  const { error: profileError } = await client.from('profiles').insert(
    {
      id: applicant.id,
      email: applicant.email,
      full_name: applicant.name,
      phone: applicant.phone ?? null,
      role: status === 'ACTIVE' ? 'admin' : 'user',
      updated_at: now,
    } as never
  );
  if (profileError) throw new Error(profileError.message);
}

export async function fetchAdminCrimes(limit = 80): Promise<Crime[]> {
  const client = getClient();
  const table = await detectReadableTable(CRIME_TABLES);
  const orderColumn = table === 'Crime' ? 'createdAt' : 'created_at';
  const { data, error } = await client
    .from(table)
    .select('*')
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .map(mapCrimeRowLoose)
    .filter((crime): crime is Crime => Boolean(crime));
}

export async function saveAdminCrime(input: AdminCrimeInput) {
  const client = getClient();
  const table = await detectReadableTable(CRIME_TABLES);
  const payload = crimePayload(table, input);
  const query = input.id
    ? client
        .from(table)
        .update(payload as never)
        .eq('id', input.id)
    : client.from(table).insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteAdminCrime(id: string) {
  const client = getClient();
  const table = await detectReadableTable(CRIME_TABLES);
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchAdminSos(limit = 80): Promise<SOSRequest[]> {
  const client = getClient();
  const rows: SOSRequest[] = [];
  for (const table of SOS_ALERT_TABLES) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(table === 'SOSRequest' ? 'createdAt' : 'created_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingOrShapeError(error.message.toLowerCase())) continue;
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

export async function updateAdminSosStatus(id: string, status: SOSStatus) {
  const client = getClient();
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
    const { data, error } = await client
      .from(table)
      .update(payload as never)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (!error && data) return;
    if (!error) continue;
    lastError = error.message;
    if (!isMissingOrShapeError(lastError.toLowerCase())) break;
  }
  throw new Error(lastError || 'SOS report was not found.');
}

export async function fetchCriminalRecords(limit = 80): Promise<AdminCriminalRecord[]> {
  try {
    const client = getClient();
    const table = await detectReadableTable(CRIMINAL_TABLES);
    const { data, error } = await client.from(table).select('*').limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[])
      .map(normalizeCriminal)
      .filter((row) => row.id)
      .sort((a, b) => b.score - a.score);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (isMissingOrShapeError(lower) || isPermissionError(lower)) {
      // Regular (non-admin) mobile users may be blocked by RLS on criminal_records tables.
      // Return empty so fetchCommunityRankings can reliably fall back to the backend API
      // which serves public rankings to all authenticated users.
      return [];
    }
    throw err;
  }
}

export async function saveCriminalRecord(input: CriminalRecordInput) {
  const client = getClient();
  const table = await detectReadableTable(CRIMINAL_TABLES);
  const payload = criminalPayload(table, input);
  const query = input.id
    ? client
        .from(table)
        .update(payload as never)
        .eq('id', input.id)
    : client.from(table).insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteCriminalRecord(id: string) {
  const client = getClient();
  const table = await detectReadableTable(CRIMINAL_TABLES);
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchVolunteers(limit = 80): Promise<AdminVolunteer[]> {
  try {
    const client = getClient();
    const table = await detectReadableTable(VOLUNTEER_TABLES);
    const { data, error } = await client.from(table).select('*').limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[])
      .map(normalizeVolunteer)
      .filter((row) => row.id)
      .sort((a, b) => b.score - a.score);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (isMissingOrShapeError(lower) || isPermissionError(lower)) {
      // Regular users: fall back gracefully so community rankings can come from backend API.
      return [];
    }
    throw err;
  }
}

export async function saveVolunteer(input: VolunteerInput) {
  const client = getClient();
  const table = await detectReadableTable(VOLUNTEER_TABLES);
  const payload = volunteerPayload(input);
  const query = input.id
    ? client
        .from(table)
        .update(payload as never)
        .eq('id', input.id)
    : client.from(table).insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteVolunteer(id: string) {
  const client = getClient();
  const table = await detectReadableTable(VOLUNTEER_TABLES);
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function crimeToAdminInput(crime: Crime): AdminCrimeInput {
  return {
    id: crime.id,
    type: crime.type,
    category: crime.category,
    title: crime.title,
    description: crime.description,
    latitude: crime.location.latitude,
    longitude: crime.location.longitude,
    address: crime.location.address ?? '',
    area: crime.location.area ?? '',
    district: crime.location.district ?? '',
    division: crime.location.division ?? '',
    severity: crime.severity,
    status: crime.status,
    reportedBy: crime.reportedBy,
    dateTime: new Date(crime.dateTime).toISOString(),
  };
}

function asSeverityFromScore(score: number): Severity {
  if (score >= 450) return Severity.CRITICAL;
  if (score >= 240) return Severity.HIGH;
  if (score >= 90) return Severity.MEDIUM;
  return Severity.LOW;
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
      dangerLevel: asSeverityFromScore(row.score),
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

const DEMO_CRIMINALS: Omit<CriminalRecordInput, 'id'>[] = [
  {
    name: 'Rahim "The Shadow" Khan',
    description: 'Suspect in multiple armed robberies and vehicle thefts across Dhaka metro area. Known for targeting evening commuters.',
    knownAliases: ['Shadow', 'R.K.'],
    status: 'WANTED',
    crimeCount: 14,
    intensity: 9,
    mostFrequentCrime: CrimeType.ROBBERY,
  },
  {
    name: 'Ayesha Begum',
    description: 'Organized fraud and identity theft ring operating in university areas. Multiple victims reported phishing and document forgery.',
    knownAliases: ['A.B.', 'The Forger'],
    status: 'ARRESTED',
    crimeCount: 9,
    intensity: 6,
    mostFrequentCrime: CrimeType.FRAUD,
  },
  {
    name: 'Local Gang - Block B',
    description: 'Group involved in recurring assaults, drug distribution and extortion in residential blocks. High community impact.',
    knownAliases: ['Block B Crew'],
    status: 'UNDER_REVIEW',
    crimeCount: 23,
    intensity: 8,
    mostFrequentCrime: CrimeType.ASSAULT,
  },
];

const DEMO_VOLUNTEERS: Omit<VolunteerInput, 'id'>[] = [
  { name: 'Dr. Nafisa Rahman', email: 'nafisa@local.org', phone: '01711-223344', skills: ['doctor', 'first aid'], status: 'ACTIVE', activityCount: 28, intensity: 9 },
  { name: 'Karim Uddin', email: 'karim.v@help.bd', skills: ['engineer', 'rescue'], status: 'ACTIVE', activityCount: 19, intensity: 7 },
  { name: 'Sadia Islam', email: 'sadia@community.net', phone: '01922-556677', skills: ['counselor', 'legal aid'], status: 'ACTIVE', activityCount: 33, intensity: 8 },
];

export async function seedDemoCriminalRecords(): Promise<number> {
  const client = getClient();
  const table = await detectReadableTable(CRIMINAL_TABLES);
  let inserted = 0;
  for (const demo of DEMO_CRIMINALS) {
    try {
      const payload = criminalPayload(table, demo);
      const { error } = await client.from(table).insert(payload as never);
      if (!error) inserted++;
    } catch {
      // continue
    }
  }
  return inserted;
}

export async function seedDemoVolunteers(): Promise<number> {
  const client = getClient();
  const table = await detectReadableTable(VOLUNTEER_TABLES);
  let inserted = 0;
  for (const demo of DEMO_VOLUNTEERS) {
    try {
      const payload = volunteerPayload(demo);
      const { error } = await client.from(table).insert(payload as never);
      if (!error) inserted++;
    } catch {
      // continue
    }
  }
  return inserted;
}
