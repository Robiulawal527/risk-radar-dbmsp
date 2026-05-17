import {
  CrimeType,
  Severity,
  type CriminalRanking,
  type PhilanthropistRanking,
} from '@risk-radar/types';
import { api } from './api';
import { isSupabaseConfigured, supabase } from './supabase';

type Row = Record<string, unknown>;

const CRIMINAL_TABLES = ['criminal_records', 'CriminalRecord'] as const;
const VOLUNTEER_TABLES = ['volunteers', 'Volunteer'] as const;

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
    if (typeof value === 'string')
      return value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
  }
  return [];
}

function isMissingOrShapeError(message: string) {
  return /relation .* does not exist|table .* does not exist|could not find the table|schema cache|column .* does not exist|could not find .* column|does not exist/i.test(
    message
  );
}

function asCrimeType(value?: string): CrimeType {
  return value && (Object.values(CrimeType) as string[]).includes(value)
    ? (value as CrimeType)
    : CrimeType.OTHER;
}

function asSeverity(score: number): Severity {
  if (score >= 450) return Severity.CRITICAL;
  if (score >= 240) return Severity.HIGH;
  if (score >= 90) return Severity.MEDIUM;
  return Severity.LOW;
}

async function readFirstAvailableTable(
  candidates: readonly string[],
  limit: number
): Promise<Row[]> {
  for (const table of candidates) {
    const { data, error } = await supabase.from(table).select('*').limit(limit);
    if (!error) return (data ?? []) as Row[];
    if (!isMissingOrShapeError(error.message.toLowerCase())) throw new Error(error.message);
  }
  return [];
}

async function fetchCriminalRankingsFromSupabase(limit = 50): Promise<CriminalRanking[]> {
  const rows = await readFirstAvailableTable(CRIMINAL_TABLES, limit);
  return rows
    .map((row) => {
      const crimeCount = num(row, 'crime_count', 'crimeCount') ?? 0;
      const intensity = num(row, 'intensity') ?? 1;
      const score = num(row, 'score') ?? crimeCount * intensity * 10;
      return {
        score,
        ranking: {
          rank: 0,
          criminalInfo: {
            name: str(row, 'name') ?? 'Unknown person',
            age: num(row, 'age'),
            gender: str(row, 'gender'),
            description: str(row, 'description') ?? '',
            knownAliases: arr(row, 'known_aliases', 'knownAliases'),
            photoUrl: str(row, 'photo_url', 'photoUrl'),
            status: str(row, 'status') ?? 'UNDER_REVIEW',
          },
          crimeCount,
          mostFrequentCrime: asCrimeType(str(row, 'most_frequent_crime', 'mostFrequentCrime')),
          dangerLevel: asSeverity(score),
        } satisfies CriminalRanking,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item.ranking, rank: index + 1 }));
}

async function fetchVolunteerRankingsFromSupabase(limit = 50): Promise<PhilanthropistRanking[]> {
  const rows = await readFirstAvailableTable(VOLUNTEER_TABLES, limit);
  return rows
    .map((row) => {
      const activityCount = num(row, 'activity_count', 'activityCount') ?? 0;
      const intensity = num(row, 'intensity') ?? 1;
      const score = num(row, 'score') ?? activityCount * intensity * 10;
      return {
        score,
        ranking: {
          rank: 0,
          userId: str(row, 'id') ?? `${str(row, 'email') ?? 'volunteer'}-${score}`,
          name: str(row, 'name', 'full_name') ?? 'Volunteer',
          avatar: str(row, 'avatar'),
          reportsSubmitted: activityCount,
          accuracy: Math.min(1, Math.max(0, intensity / 10)),
          contribution: Math.round(score),
        } satisfies PhilanthropistRanking,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item.ranking, rank: index + 1 }));
}

export async function fetchCommunityRankings(): Promise<{
  criminals: CriminalRanking[];
  philanthropists: PhilanthropistRanking[];
}> {
  if (isSupabaseConfigured()) {
    try {
      const [criminals, philanthropists] = await Promise.all([
        fetchCriminalRankingsFromSupabase(),
        fetchVolunteerRankingsFromSupabase(),
      ]);
      if (criminals.length || philanthropists.length) return { criminals, philanthropists };
    } catch {
      /* Fall back to the API so older deployments still work. */
    }
  }

  const [criminals, philanthropists] = await Promise.all([
    api.get<{ success: boolean; data: CriminalRanking[] }>('/analytics/rankings/criminals'),
    api.get<{ success: boolean; data: PhilanthropistRanking[] }>(
      '/analytics/rankings/philanthropists'
    ),
  ]);
  return {
    criminals: criminals.data.data ?? [],
    philanthropists: philanthropists.data.data ?? [],
  };
}
