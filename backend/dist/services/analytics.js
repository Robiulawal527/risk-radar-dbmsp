"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocialRadarMatches = getSocialRadarMatches;
exports.getCrimeStats = getCrimeStats;
exports.getAreaRankings = getAreaRankings;
exports.getCriminalRankings = getCriminalRankings;
exports.getPhilanthropistRankings = getPhilanthropistRankings;
const database_1 = require("@risk-radar/database");
const types_1 = require("@risk-radar/types");
const cache_js_1 = require("../lib/cache.js");
async function getSocialRadarMatches(currentUserId, wantedInterests, wantedSkills) {
    const rows = await (0, database_1.query)(`SELECT u.id, u.name, u.email, u.avatar, u.phone, u.skills,
      COALESCE((SELECT COUNT(*)::int FROM "Crime" c WHERE c."userId" = u.id), 0) AS crime_n,
      COALESCE((SELECT COUNT(*)::int FROM "SOSRequest" s WHERE s."userId" = u.id), 0) AS sos_n,
      (SELECT COALESCE(json_agg(json_build_object('id', c.id, 'severity', c.severity)), '[]'::json)
       FROM "Crime" c WHERE c."userId" = u.id) AS crimes_json
     FROM "User" u
     WHERE u.id <> $1
     LIMIT 100`, [currentUserId]);
    const normalizedWantedInterests = wantedInterests.map((v) => v.toLowerCase());
    const normalizedWantedSkills = wantedSkills.map((v) => v.toLowerCase());
    const matches = rows.map((user) => {
        const crimes = Array.isArray(user.crimes_json) ? user.crimes_json : [];
        const profileSkills = Array.isArray(user.skills) ? user.skills.filter(Boolean) : [];
        const profileInterests = profileSkills;
        const riskPenalty = crimes.reduce((acc, crime) => {
            if (crime.severity === 'CRITICAL')
                return acc + 20;
            if (crime.severity === 'HIGH')
                return acc + 12;
            if (crime.severity === 'MEDIUM')
                return acc + 6;
            return acc + 3;
        }, 0);
        const crimeScore = Math.max(0, 100 - riskPenalty);
        const goodWorkScore = Math.min(100, user.sos_n * 8 + crimes.length * 5 + 25);
        const trustScore = Math.round(crimeScore * 0.6 + goodWorkScore * 0.4);
        const interestOverlap = normalizedWantedInterests.filter((wanted) => profileInterests.some((own) => own.toLowerCase() === wanted)).length;
        const skillOverlap = normalizedWantedSkills.filter((wanted) => profileSkills.some((own) => own.toLowerCase() === wanted)).length;
        const interestScore = normalizedWantedInterests.length
            ? Math.round((interestOverlap / normalizedWantedInterests.length) * 100)
            : 70;
        const skillScore = normalizedWantedSkills.length
            ? Math.round((skillOverlap / normalizedWantedSkills.length) * 100)
            : 70;
        const compatibilityScore = Math.round(interestScore * 0.5 + skillScore * 0.3 + trustScore * 0.2);
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
        if (!normalizedWantedSkills.length && !normalizedWantedInterests.length)
            return true;
        const searchable = [...match.skills, ...match.interests].map((value) => value.toLowerCase());
        return [...normalizedWantedSkills, ...normalizedWantedInterests].some((wanted) => searchable.some((own) => own.includes(wanted)));
    })
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, 20);
}
async function getCrimeStats() {
    return (0, cache_js_1.cached)('analytics:stats', async () => {
        const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*)::text AS n FROM "Crime"`);
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
    }, { ttlMs: cache_js_1.CACHE_TTL.STATS_AND_RANKINGS });
}
async function getCrimesByType() {
    const results = await (0, database_1.query)(`SELECT type, COUNT(*)::text AS c FROM "Crime" GROUP BY type`);
    const crimesByType = {};
    results.forEach((r) => {
        crimesByType[r.type] = Number(r.c);
    });
    Object.values(types_1.CrimeType).forEach((type) => {
        if (!crimesByType[type])
            crimesByType[type] = 0;
    });
    return crimesByType;
}
async function getCrimesBySeverity() {
    const results = await (0, database_1.query)(`SELECT severity, COUNT(*)::text AS c FROM "Crime" GROUP BY severity`);
    const crimesBySeverity = {};
    results.forEach((r) => {
        crimesBySeverity[r.severity] = Number(r.c);
    });
    Object.values(types_1.Severity).forEach((severity) => {
        if (!crimesBySeverity[severity])
            crimesBySeverity[severity] = 0;
    });
    return crimesBySeverity;
}
async function getCrimesByArea() {
    const results = await (0, database_1.query)(`SELECT area, severity, COUNT(*)::text AS cnt
     FROM "Crime"
     WHERE area IS NOT NULL
     GROUP BY area, severity
     ORDER BY COUNT(*) DESC
     LIMIT 20`);
    const areaMap = new Map();
    results.forEach((r) => {
        if (!areaMap.has(r.area)) {
            areaMap.set(r.area, { count: 0, severities: new Map() });
        }
        const areaData = areaMap.get(r.area);
        const c = Number(r.cnt);
        areaData.count += c;
        areaData.severities.set(r.severity, c);
    });
    return Array.from(areaMap.entries()).map(([area, data]) => {
        const highestSeverity = Array.from(data.severities.entries()).sort((a, b) => b[1] - a[1])[0];
        return {
            area,
            count: data.count,
            riskLevel: highestSeverity?.[0] || types_1.Severity.LOW,
        };
    });
}
async function getTrends() {
    const crimes = await (0, database_1.query)(`SELECT to_char("dateTime", 'YYYY-MM-DD') AS d, COUNT(*)::text AS cnt
     FROM "Crime"
     WHERE "dateTime" >= NOW() - INTERVAL '30 days'
     GROUP BY d
     ORDER BY d ASC`);
    return crimes.map((row) => ({
        date: row.d,
        count: Number(row.cnt),
    }));
}
async function getAreaRankings() {
    return (0, cache_js_1.cached)('analytics:area-rankings', async () => {
        const results = await (0, database_1.query)(`SELECT area, district, COUNT(*)::text AS cnt
         FROM "Crime"
         WHERE area IS NOT NULL
         GROUP BY area, district
         ORDER BY COUNT(*) DESC
         LIMIT 50`);
        return results.map((r, index) => ({
            rank: index + 1,
            area: r.area,
            district: r.district ?? '',
            crimeCount: Number(r.cnt),
            riskLevel: calculateRiskLevel(Number(r.cnt)),
            crimeTypes: Object.values(types_1.CrimeType).reduce((acc, t) => ({ ...acc, [t]: 0 }), {}),
            trend: 'STABLE',
        }));
    }, { ttlMs: cache_js_1.CACHE_TTL.STATS_AND_RANKINGS });
}
async function getCriminalRankings() {
    return (0, cache_js_1.cached)('analytics:criminal-rankings', async () => {
        // Support both legacy backend table name and the public table created by Supabase migrations (006)
        // Try camelCase first (older), then snake_case public table.
        let criminals = [];
        try {
            criminals = await (0, database_1.query)(`SELECT name, age, gender, description, "knownAliases", "photoUrl", status, "crimeCount", intensity, score, "mostFrequentCrime"
           FROM "CriminalRecord"
           ORDER BY "crimeCount" DESC
           LIMIT 50`);
        }
        catch {
            // ignore, try next table
        }
        if (!criminals || criminals.length === 0) {
            try {
                criminals = await (0, database_1.query)(`SELECT name, age, gender, description, known_aliases, photo_url, status, crime_count, intensity, score, most_frequent_crime
             FROM criminal_records
             ORDER BY COALESCE(score, crime_count * COALESCE(intensity, 1) * 10) DESC
             LIMIT 50`);
            }
            catch {
                // final fallback: empty
                criminals = [];
            }
        }
        return (criminals || []).map((criminal, index) => {
            const crimeCount = Number(criminal.crimeCount ?? criminal.crime_count ?? 0);
            const score = Number(criminal.score ?? crimeCount * (Number(criminal.intensity) || 1) * 10);
            const aliases = (criminal.knownAliases ?? criminal.known_aliases ?? []);
            const photo = criminal.photoUrl ?? criminal.photo_url ?? undefined;
            const mfc = (criminal.mostFrequentCrime ?? criminal.most_frequent_crime ?? 'OTHER');
            return {
                rank: index + 1,
                criminalInfo: {
                    name: criminal.name,
                    age: criminal.age ?? undefined,
                    gender: criminal.gender ?? undefined,
                    description: criminal.description,
                    knownAliases: Array.isArray(aliases) ? aliases : [],
                    photoUrl: photo ?? undefined,
                    status: criminal.status || 'UNDER_REVIEW',
                },
                crimeCount,
                mostFrequentCrime: Object.values(types_1.CrimeType).includes(mfc) ? mfc : types_1.CrimeType.OTHER,
                dangerLevel: calculateRiskLevel(crimeCount),
            };
        });
    }, { ttlMs: cache_js_1.CACHE_TTL.STATS_AND_RANKINGS });
}
async function getPhilanthropistRankings() {
    return (0, cache_js_1.cached)('analytics:philanthropist-rankings', async () => {
        // Prefer dedicated volunteers table (from Supabase migration 006 / admin management) if it has rows.
        let volunteers = [];
        try {
            volunteers = await (0, database_1.query)(`SELECT id, name, avatar, activity_count, intensity, score
           FROM volunteers
           ORDER BY COALESCE(score, activity_count * COALESCE(intensity, 1) * 10) DESC
           LIMIT 50`);
        }
        catch {
            // ignore
        }
        if (volunteers && volunteers.length > 0) {
            return volunteers.map((v, index) => {
                const activity = Number(v.activity_count ?? v.activityCount ?? 0);
                const intensity = Number(v.intensity ?? 1);
                const score = Number(v.score ?? activity * intensity * 10);
                return {
                    rank: index + 1,
                    userId: v.id || `vol-${index}`,
                    name: v.name || 'Volunteer',
                    avatar: v.avatar ?? undefined,
                    reportsSubmitted: activity,
                    accuracy: Math.min(1, Math.max(0, intensity / 10)),
                    contribution: Math.round(score),
                };
            });
        }
        // Fallback: rank users by number of submitted crimes (proxy for top contributors/reporters).
        const users = await (0, database_1.query)(`SELECT u.id, u.name, u.avatar, COUNT(c.id)::text AS cnt
     FROM "User" u
     LEFT JOIN "Crime" c ON c."userId" = u.id
     GROUP BY u.id, u.name, u.avatar
     ORDER BY COUNT(c.id) DESC
     LIMIT 50`);
        return users.map((user, index) => ({
            rank: index + 1,
            userId: user.id,
            name: user.name,
            avatar: user.avatar ?? undefined,
            reportsSubmitted: Number(user.cnt),
            accuracy: 0.95,
            contribution: Number(user.cnt) * 10,
        }));
    }, { ttlMs: cache_js_1.CACHE_TTL.STATS_AND_RANKINGS });
}
function calculateRiskLevel(count) {
    if (count >= 50)
        return types_1.Severity.CRITICAL;
    if (count >= 30)
        return types_1.Severity.HIGH;
    if (count >= 10)
        return types_1.Severity.MEDIUM;
    return types_1.Severity.LOW;
}
//# sourceMappingURL=analytics.js.map