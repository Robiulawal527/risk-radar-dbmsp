import { CrimeType, Severity, type Crime, type SocialRadarMatch } from '@risk-radar/types';
import { api } from './api';
import { supabase, isSupabaseConfigured } from './supabase';

type CrimeInput = {
  type: CrimeType;
  category: CrimeType;
  title: string;
  description: string;
  severity: Severity;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    area?: string;
    district?: string;
    division?: string;
  };
  reportedBy: string;
  dateTime: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar: string | null;
  role: string | null;
  skills: string[] | null;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  role: string | null;
  skills: string[] | null;
};

const CRIME_TABLES = ['crimes', 'Crime', 'crime', 'incidents'];

type CrimePayload = Record<string, unknown>;

function crimePayload(input: CrimeInput, userId: string) {
  return {
    type: input.type,
    category: input.category || input.type,
    title: input.title,
    description: input.description,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    address: input.location.address ?? null,
    area: input.location.area ?? null,
    district: input.location.district ?? null,
    division: input.location.division ?? null,
    severity: input.severity,
    status: 'REPORTED',
    reportedBy: input.reportedBy,
    userId,
    victimInfo: {},
    criminalInfo: [],
    witnesses: [],
    dateTime: input.dateTime,
  };
}

function withoutUndefined(payload: CrimePayload): CrimePayload {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function crimePayloadAttempts(input: CrimeInput, userId: string): CrimePayload[] {
  const base = crimePayload(input, userId);
  const now = new Date().toISOString();
  const snake = withoutUndefined({
    user_id: userId,
    type: base.type,
    category: base.category,
    title: base.title,
    description: base.description,
    latitude: base.latitude,
    longitude: base.longitude,
    address: base.address,
    area: base.area,
    district: base.district,
    division: base.division,
    severity: base.severity,
    status: base.status,
    reported_by: base.reportedBy,
    victim_info: base.victimInfo,
    criminal_info: base.criminalInfo,
    witnesses: base.witnesses,
    date_time: base.dateTime,
    created_at: now,
    updated_at: now,
  });
  const publicCrimes = withoutUndefined({
    user_id: userId,
    type: base.type,
    category: base.category,
    title: base.title,
    description: base.description,
    latitude: base.latitude,
    longitude: base.longitude,
    address: base.address,
    area: base.area,
    district: base.district,
    division: base.division,
    severity: base.severity,
    status: base.status,
    reported_by: base.reportedBy,
    date_time: base.dateTime,
    created_at: now,
  });
  const common = withoutUndefined({
    user_id: userId,
    reporter_id: userId,
    type: base.type,
    category: base.category,
    title: base.title,
    description: base.description,
    latitude: base.latitude,
    longitude: base.longitude,
    area: base.area,
    severity: base.severity,
    status: base.status,
    reported_by: base.reportedBy,
    occurred_at: base.dateTime,
    created_at: now,
  });
  const appSchema = withoutUndefined(base);
  const appSchemaNoUser = withoutUndefined({
    ...base,
    userId: undefined,
  });

  const attempts = [snake, publicCrimes, common, appSchema, appSchemaNoUser];
  const seen = new Set<string>();
  return attempts.filter((payload) => {
    const key = JSON.stringify(Object.keys(payload).sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ensureBackendUser() {
  try {
    await api.get('/auth/me');
  } catch {
    // Direct Supabase insert may still work on schemas without the "User" FK.
  }
}

async function insertCrimeIntoSupabase(input: CrimeInput, userId: string): Promise<Crime | null> {
  let lastError: unknown;

  for (const table of CRIME_TABLES) {
    for (const payload of crimePayloadAttempts(input, userId)) {
      const { data, error } = await supabase.from(table).insert(payload).select('*').maybeSingle();

      if (!error) {
        const row = (data ?? payload) as Record<string, unknown>;
        return {
          id: String(row.id ?? `local-${Date.now()}`),
          type: input.type,
          category: input.category,
          title: input.title,
          description: input.description,
          location: input.location,
          severity: input.severity,
          status: String(row.status ?? 'REPORTED'),
          reportedBy: input.reportedBy,
          dateTime: new Date(String(row.dateTime ?? row.date_time ?? row.occurred_at ?? input.dateTime)),
          createdAt: new Date(String(row.createdAt ?? row.created_at ?? input.dateTime)),
          updatedAt: new Date(String(row.updatedAt ?? row.updated_at ?? input.dateTime)),
        };
      }

      const fallback = await supabase.from(table).insert(payload);
      if (!fallback.error) {
        return {
          id: `local-${Date.now()}`,
          type: input.type,
          category: input.category,
          title: input.title,
          description: input.description,
          location: input.location,
          severity: input.severity,
          status: 'REPORTED',
          reportedBy: input.reportedBy,
          dateTime: new Date(input.dateTime),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      lastError = fallback.error ?? error;
    }

    const message =
      lastError && typeof lastError === 'object' && 'message' in lastError
        ? String((lastError as { message?: string }).message).toLowerCase()
        : '';
    if (!message.includes('relation') && !message.includes('table') && !message.includes('does not exist')) break;
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Could not save report to Supabase.');
}

export async function submitCrimeReport(input: CrimeInput): Promise<Crime> {
  let supabaseError: unknown;

  if (isSupabaseConfigured()) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (userId) {
      try {
        await ensureBackendUser();
        const crime = await insertCrimeIntoSupabase(input, userId);
        if (crime) return crime;
      } catch (firstError) {
        supabaseError = firstError;
        const message = firstError instanceof Error ? firstError.message.toLowerCase() : '';
        if (message.includes('foreign key') || message.includes('violates foreign key')) {
          try {
            await ensureBackendUser();
            const crime = await insertCrimeIntoSupabase(input, userId);
            if (crime) return crime;
          } catch (retryError) {
            supabaseError = retryError;
          }
        }
      }
    }
  }

  try {
    const response = await api.post<{ success: boolean; data: Crime }>('/crimes', input);
    return response.data.data;
  } catch (apiError) {
    throw supabaseError instanceof Error ? supabaseError : apiError;
  }
}

function toMatch(row: ProfileRow): SocialRadarMatch {
  const email = row.email || '';
  const skills = row.skills ?? [];
  return {
    id: row.id,
    userId: row.id,
    email,
    name: row.full_name || email.split('@')[0] || 'User',
    phone: row.phone,
    avatar: row.avatar,
    interests: [],
    skills,
    crimeScore: 0,
    goodWorkScore: 0,
    trustScore: Math.min(100, 70 + skills.length * 5),
    compatibilityScore: Math.min(100, 65 + skills.length * 8),
    totalCrimeRecords: 0,
    totalGoodWorkRecords: 0,
  };
}

function userToMatch(row: UserRow): SocialRadarMatch {
  const email = row.email || '';
  const skills = row.skills ?? [];
  return {
    id: row.id,
    userId: row.id,
    email,
    name: row.name || email.split('@')[0] || 'User',
    phone: row.phone,
    avatar: row.avatar,
    interests: [],
    skills,
    crimeScore: 0,
    goodWorkScore: 0,
    trustScore: Math.min(100, 70 + skills.length * 5),
    compatibilityScore: Math.min(100, 65 + skills.length * 8),
    totalCrimeRecords: 0,
    totalGoodWorkRecords: 0,
  };
}

export async function searchProfilesBySkill(skill: string): Promise<SocialRadarMatch[]> {
  const query = skill.trim().toLowerCase();
  if (!query) return [];

  if (isSupabaseConfigured()) {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, avatar, role, skills')
      .order('full_name', { ascending: true })
      .limit(200);

    if (!error) {
      const matches = ((data ?? []) as ProfileRow[])
        .filter((row) => row.id !== currentUserId)
        .filter((row) => (row.skills ?? []).some((ownSkill) => ownSkill.toLowerCase().includes(query)))
        .map(toMatch);
      if (matches.length > 0) return matches;
    }

    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id, email, name, phone, avatar, role, skills')
      .order('name', { ascending: true })
      .limit(200);

    if (!usersError) {
      const matches = ((users ?? []) as UserRow[])
        .filter((row) => row.id !== currentUserId)
        .filter((row) => (row.skills ?? []).some((ownSkill) => ownSkill.toLowerCase().includes(query)))
        .map(userToMatch);
      if (matches.length > 0) return matches;
    }
  }

  const response = await api.get<{ success: boolean; data: SocialRadarMatch[] }>('/users/search', {
    params: { skill },
  });
  return response.data.data ?? [];
}
