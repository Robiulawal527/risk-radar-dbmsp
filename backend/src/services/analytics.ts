import { query, queryOne } from '@risk-radar/database';
import {
  CrimeType,
  Severity,
  type AreaRanking,
  type CrimeStats,
  type CriminalRanking,
  type PhilanthropistRanking,
} from '@risk-radar/types';

type CrimeSeverityRow = { id: string; severity: string };

export async function getSocialRadarMatches(
  currentUserId: string,
  wantedInterests: string[],
  wantedSkills: string[]
) {
  type Row = {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    phone: string | null;
    skills: string[] | null;
    crime_n: number;
    sos_n: number;
    crimes_json: CrimeSeverityRow[] | null;
  };

  const rows = await query<Row>(
    `SELECT u.id, u.name, u.email, u.avatar, u.phone, u.skills,
      COALESCE((SELECT COUNT(*)::int FROM "Crime" c WHERE c."userId" = u.id), 0) AS crime_n,
      COALESCE((SELECT COUNT(*)::int FROM "SOSRequest" s WHERE s."userId" = u.id), 0) AS sos_n,
      (SELECT COALESCE(json_agg(json_build_object('id', c.id, 'severity', c.severity)), '[]'::json)
       FROM "Crime" c WHERE c."userId" = u.id) AS crimes_json
     FROM "User" u
     WHERE u.id <> $1
     LIMIT 100`,
    [currentUserId]
  );

  const normalizedWantedInterests = wantedInterests.map((v) => v.toLowerCase());
  const normalizedWantedSkills = wantedSkills.map((v) => v.toLowerCase());

  const matches = rows.map((user) => {
    const crimes = Array.isArray(user.crimes_json) ? user.crimes_json : [];
    const profileSkills = Array.isArray(user.skills) ? user.skills.filter(Boolean) : [];
    const profileInterests = profileSkills;
    const riskPenalty = crimes.reduce((acc, crime) => {
      if (crime.severity === 'CRITICAL') return acc + 20;
      if (crime.severity === 'HIGH') return acc + 12;
      if (crime.severity === 'MEDIUM') return acc + 6;
      return acc + 3;
    }, 0);
    const crimeScore = Math.max(0, 100 - riskPenalty);
    const goodWorkScore = Math.min(100, user.sos_n * 8 + crimes.length * 5 + 25);
    const trustScore = Math.round(crimeScore * 0.6 + goodWorkScore * 0.4);

    const interestOverlap = normalizedWantedInterests.filter((wanted) =>
      profileInterests.some((own) => own.toLowerCase() === wanted)
    ).length;
    const skillOverlap = normalizedWantedSkills.filter((wanted) =>
      profileSkills.some((own) => own.toLowerCase() === wanted)
    ).length;
    const interestScore = normalizedWantedInterests.length
      ? Math.round((interestOverlap / normalizedWantedInterests.length) * 100)
      : 70;
    const skillScore = normalizedWantedSkills.length
      ? Math.round((skillOverlap / normalizedWantedSkills.length) * 100)
      : 70;
    const compatibilityScore = Math.round(
      interestScore * 0.5 + skillScore * 0.3 + trustScore * 0.2
    );

    return {
      userId: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      interests: profileInterests,
      skills: profileSkills,
      crimeScore,
      goodWorkScore,
      trustScore,
      compatibilityScore,
      totalCrimeRecords: crimes.length,
      totalGoodWorkRecords: user.sos_n,
    };
  });

  return matches
    .filter((match) => {
      if (!normalizedWantedSkills.length && !normalizedWantedInterests.length) return true;
      const searchable = [...match.skills, ...match.interests].map((value) => value.toLowerCase());
      return [...normalizedWantedSkills, ...normalizedWantedInterests].some((wanted) =>
        searchable.some((own) => own.includes(wanted))
      );
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 20);
}

export async function getCrimeStats(): Promise<CrimeStats> {
  const totalRow = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "Crime"`);
  const totalCrimes = Number(totalRow?.n || 0);

  const [crimesByType, crimesBySeverity, crimesByArea] = await Promise.all([
    getCrimesByType(),
    getCrimesBySeverity(),
    getCrimesByArea(),
  ]);

  const trends = await getTrends();

  return {
    totalCrimes,
    crimesByType,
    crimesBySeverity,
    crimesByArea,
    trends,
  };
}

async function getCrimesByType(): Promise<Record<CrimeType, number>> {
  const results = await query<{ type: string; c: string }>(
    `SELECT type, COUNT(*)::text AS c FROM "Crime" GROUP BY type`
  );

  const crimesByType: Record<string, number> = {};
  results.forEach((r) => {
    crimesByType[r.type] = Number(r.c);
  });

  Object.values(CrimeType).forEach((type) => {
    if (!crimesByType[type]) crimesByType[type] = 0;
  });

  return crimesByType as Record<CrimeType, number>;
}

async function getCrimesBySeverity(): Promise<Record<Severity, number>> {
  const results = await query<{ severity: string; c: string }>(
    `SELECT severity, COUNT(*)::text AS c FROM "Crime" GROUP BY severity`
  );

  const crimesBySeverity: Record<string, number> = {};
  results.forEach((r) => {
    crimesBySeverity[r.severity] = Number(r.c);
  });

  Object.values(Severity).forEach((severity) => {
    if (!crimesBySeverity[severity]) crimesBySeverity[severity] = 0;
  });

  return crimesBySeverity as Record<Severity, number>;
}

async function getCrimesByArea() {
  const results = await query<{ area: string; severity: string; cnt: string }>(
    `SELECT area, severity, COUNT(*)::text AS cnt
     FROM "Crime"
     WHERE area IS NOT NULL
     GROUP BY area, severity
     ORDER BY COUNT(*) DESC
     LIMIT 20`
  );

  const areaMap = new Map<string, { count: number; severities: Map<Severity, number> }>();

  results.forEach((r) => {
    if (!areaMap.has(r.area)) {
      areaMap.set(r.area, { count: 0, severities: new Map() });
    }
    const areaData = areaMap.get(r.area)!;
    const c = Number(r.cnt);
    areaData.count += c;
    areaData.severities.set(r.severity as Severity, c);
  });

  return Array.from(areaMap.entries()).map(([area, data]) => {
    const highestSeverity = Array.from(data.severities.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      area,
      count: data.count,
      riskLevel: highestSeverity?.[0] || Severity.LOW,
    };
  });
}

async function getTrends() {
  const crimes = await query<{ d: string; cnt: string }>(
    `SELECT to_char("dateTime", 'YYYY-MM-DD') AS d, COUNT(*)::text AS cnt
     FROM "Crime"
     WHERE "dateTime" >= NOW() - INTERVAL '30 days'
     GROUP BY d
     ORDER BY d ASC`
  );

  return crimes.map((row) => ({
    date: row.d,
    count: Number(row.cnt),
  }));
}

export async function getAreaRankings(): Promise<AreaRanking[]> {
  const results = await query<{ area: string; district: string | null; cnt: string }>(
    `SELECT area, district, COUNT(*)::text AS cnt
     FROM "Crime"
     WHERE area IS NOT NULL
     GROUP BY area, district
     ORDER BY COUNT(*) DESC
     LIMIT 50`
  );

  return results.map((r, index) => ({
    rank: index + 1,
    area: r.area,
    district: r.district ?? '',
    crimeCount: Number(r.cnt),
    riskLevel: calculateRiskLevel(Number(r.cnt)),
    crimeTypes: Object.values(CrimeType).reduce(
      (acc, t) => ({ ...acc, [t]: 0 }),
      {} as Record<CrimeType, number>
    ),
    trend: 'STABLE' as const,
  }));
}

export async function getCriminalRankings(): Promise<CriminalRanking[]> {
  const criminals = await query<{
    name: string;
    age: number | null;
    gender: string | null;
    description: string;
    knownAliases: unknown;
    photoUrl: string | null;
    status: string;
    crimeCount: number;
  }>(
    `SELECT name, age, gender, description, "knownAliases", "photoUrl", status, "crimeCount"
     FROM "CriminalRecord"
     ORDER BY "crimeCount" DESC
     LIMIT 50`
  );

  return criminals.map((criminal, index) => ({
    rank: index + 1,
    criminalInfo: {
      name: criminal.name,
      age: criminal.age ?? undefined,
      gender: criminal.gender ?? undefined,
      description: criminal.description,
      knownAliases: criminal.knownAliases as string[],
      photoUrl: criminal.photoUrl ?? undefined,
      status: criminal.status,
    },
    crimeCount: criminal.crimeCount,
    mostFrequentCrime: CrimeType.THEFT,
    dangerLevel: calculateRiskLevel(criminal.crimeCount),
  }));
}

export async function getPhilanthropistRankings(): Promise<PhilanthropistRanking[]> {
  const users = await query<{ id: string; name: string; avatar: string | null; cnt: string }>(
    `SELECT u.id, u.name, u.avatar, COUNT(c.id)::text AS cnt
     FROM "User" u
     LEFT JOIN "Crime" c ON c."userId" = u.id
     GROUP BY u.id, u.name, u.avatar
     ORDER BY COUNT(c.id) DESC
     LIMIT 50`
  );

  return users.map((user, index) => ({
    rank: index + 1,
    userId: user.id,
    name: user.name,
    avatar: user.avatar ?? undefined,
    reportsSubmitted: Number(user.cnt),
    accuracy: 0.95,
    contribution: Number(user.cnt) * 10,
  }));
}

function calculateRiskLevel(count: number): Severity {
  if (count >= 50) return Severity.CRITICAL;
  if (count >= 30) return Severity.HIGH;
  if (count >= 10) return Severity.MEDIUM;
  return Severity.LOW;
}
