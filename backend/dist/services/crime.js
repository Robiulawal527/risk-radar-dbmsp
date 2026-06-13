"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAll = findAll;
exports.findById = findById;
exports.create = create;
exports.update = update;
exports.remove = remove;
exports.findByArea = findByArea;
exports.findByCoordinates = findByCoordinates;
const database_1 = require("@risk-radar/database");
const http_error_js_1 = require("../lib/http-error.js");
const validation_js_1 = require("../lib/validation.js");
const nearby_alerts_js_1 = require("./nearby-alerts.js");
const cache_js_1 = require("../lib/cache.js");
function buildListWhere(params) {
    const parts = ['c.latitude IS NOT NULL', 'c.longitude IS NOT NULL'];
    const values = [];
    let n = 1;
    if (params.type) {
        parts.push(`c.type = $${n++}`);
        values.push(params.type);
    }
    if (params.severity) {
        parts.push(`c.severity = $${n++}`);
        values.push(params.severity);
    }
    if (params.area) {
        parts.push(`c.area ILIKE $${n++}`);
        values.push(`%${params.area}%`);
    }
    if (params.district) {
        parts.push(`c.district ILIKE $${n++}`);
        values.push(`%${params.district}%`);
    }
    return { sql: `WHERE ${parts.join(' AND ')}`, values };
}
function formatCrime(crime, evidence = []) {
    return {
        id: crime.id,
        type: crime.type,
        category: crime.category,
        title: crime.title,
        description: crime.description,
        location: {
            latitude: crime.latitude,
            longitude: crime.longitude,
            address: crime.address ?? undefined,
            area: crime.area ?? undefined,
            district: crime.district ?? undefined,
            division: crime.division ?? undefined,
        },
        severity: crime.severity,
        status: crime.status,
        reportedBy: crime.reportedBy,
        victimInfo: crime.victimInfo || undefined,
        criminalInfo: crime.criminalInfo || [],
        witnesses: crime.witnesses || [],
        evidence: evidence || [],
        dateTime: crime.dateTime,
        createdAt: crime.createdAt,
        updatedAt: crime.updatedAt,
    };
}
async function loadEvidenceForCrimes(crimeIds) {
    if (crimeIds.length === 0)
        return new Map();
    const rows = await (0, database_1.query)(`SELECT * FROM "Evidence" WHERE "crimeId" = ANY($1::text[])`, [crimeIds]);
    const map = new Map();
    for (const e of rows) {
        if (!map.has(e.crimeId))
            map.set(e.crimeId, []);
        map.get(e.crimeId).push(e);
    }
    return map;
}
async function findAll(params) {
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));
    const skip = (page - 1) * limit;
    const { sql: whereSql, values: whereVals } = buildListWhere({
        type: params.type,
        severity: params.severity,
        area: params.area,
        district: params.district,
    });
    let n = whereVals.length + 1;
    const countRow = await (0, database_1.queryOne)(`SELECT COUNT(*)::text AS count FROM "Crime" c ${whereSql}`, whereVals);
    const total = Number(countRow?.count || 0);
    const crimes = await (0, database_1.query)(`SELECT c.* FROM "Crime" c ${whereSql}
     ORDER BY c."createdAt" DESC
     LIMIT $${n++} OFFSET $${n++}`, [...whereVals, limit, skip]);
    const ids = crimes.map((c) => c.id);
    const evMap = await loadEvidenceForCrimes(ids);
    return {
        items: crimes.map((c) => formatCrime(c, evMap.get(c.id) || [])),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
    };
}
async function findById(id) {
    const crime = await (0, database_1.queryOne)('SELECT * FROM "Crime" WHERE id = $1', [id]);
    if (!crime) {
        throw new http_error_js_1.HttpError(404, `Crime with ID ${id} not found`);
    }
    const evMap = await loadEvidenceForCrimes([id]);
    return formatCrime(crime, evMap.get(id) || []);
}
async function create(data, userId) {
    const location = data.location;
    if (!location)
        throw new http_error_js_1.HttpError(400, 'Location is required');
    const latitude = (0, validation_js_1.normalizeFiniteNumber)(location.latitude, 'Latitude');
    const longitude = (0, validation_js_1.normalizeFiniteNumber)(location.longitude, 'Longitude');
    if (latitude < -90 || latitude > 90)
        throw new http_error_js_1.HttpError(400, 'Latitude must be between -90 and 90');
    if (longitude < -180 || longitude > 180) {
        throw new http_error_js_1.HttpError(400, 'Longitude must be between -180 and 180');
    }
    const title = (0, validation_js_1.normalizeRequiredText)(data.title, 'Title', 4, 160);
    const description = (0, validation_js_1.normalizeRequiredText)(data.description, 'Description', 20, 3000);
    const area = (0, validation_js_1.normalizeRequiredText)(location.area, 'Area', 3, 120);
    const reportedBy = (0, validation_js_1.normalizeRequiredText)(data.reportedBy, 'Reported by', 2, 160);
    const type = data.type;
    const severity = data.severity;
    if (!type)
        throw new http_error_js_1.HttpError(400, 'Crime type is required');
    if (!severity)
        throw new http_error_js_1.HttpError(400, 'Severity is required');
    const crime = await (0, database_1.queryOne)(`INSERT INTO "Crime" (
      type, category, title, description, latitude, longitude, address, area, district, division,
      severity, "reportedBy", "userId", "victimInfo", "criminalInfo", witnesses, "dateTime", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17, NOW(), NOW()
    ) RETURNING *`, [
        data.type,
        data.category || type,
        title,
        description,
        latitude,
        longitude,
        (0, validation_js_1.normalizeOptionalText)(location.address, 240),
        area,
        (0, validation_js_1.normalizeOptionalText)(location.district, 120),
        (0, validation_js_1.normalizeOptionalText)(location.division, 120),
        severity,
        reportedBy,
        userId,
        JSON.stringify(data.victimInfo || {}),
        JSON.stringify(data.criminalInfo || []),
        JSON.stringify(data.witnesses || []),
        data.dateTime || new Date(),
    ]);
    if (!crime)
        throw new http_error_js_1.HttpError(500, 'Failed to create crime');
    // Invalidate cached public data so the community sees fresh stats/heatmap/rankings soon.
    (0, cache_js_1.invalidatePrefix)('analytics:');
    (0, cache_js_1.invalidatePrefix)('heatmap:');
    void (0, nearby_alerts_js_1.notifyUsersNearNewCrime)({
        crimeId: crime.id,
        latitude: crime.latitude,
        longitude: crime.longitude,
        title: crime.title,
        area: crime.area,
        reporterUserId: userId,
    }).catch((err) => console.error('nearby alert dispatch failed', err));
    return formatCrime(crime, []);
}
async function update(id, data) {
    const existing = await (0, database_1.queryOne)('SELECT id FROM "Crime" WHERE id = $1', [id]);
    if (!existing) {
        throw new http_error_js_1.HttpError(404, `Crime with ID ${id} not found`);
    }
    const sets = ['"updatedAt" = NOW()'];
    const values = [];
    let i = 1;
    if (data.type !== undefined) {
        sets.push(`type = $${i++}`);
        values.push(data.type);
    }
    if (data.category !== undefined) {
        sets.push(`category = $${i++}`);
        values.push(data.category);
    }
    if (data.title !== undefined) {
        sets.push(`title = $${i++}`);
        values.push(data.title);
    }
    if (data.description !== undefined) {
        sets.push(`description = $${i++}`);
        values.push(data.description);
    }
    if (data.severity !== undefined) {
        sets.push(`severity = $${i++}`);
        values.push(data.severity);
    }
    if (data.status !== undefined) {
        sets.push(`status = $${i++}`);
        values.push(data.status);
    }
    if (data.location) {
        sets.push(`latitude = $${i++}`);
        values.push(data.location.latitude);
        sets.push(`longitude = $${i++}`);
        values.push(data.location.longitude);
        sets.push(`address = $${i++}`);
        values.push(data.location.address ?? null);
        sets.push(`area = $${i++}`);
        values.push(data.location.area ?? null);
        sets.push(`district = $${i++}`);
        values.push(data.location.district ?? null);
        sets.push(`division = $${i++}`);
        values.push(data.location.division ?? null);
    }
    values.push(id);
    const crime = await (0, database_1.queryOne)(`UPDATE "Crime" SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!crime)
        throw new http_error_js_1.HttpError(404, `Crime with ID ${id} not found`);
    const evMap = await loadEvidenceForCrimes([id]);
    return formatCrime(crime, evMap.get(id) || []);
}
async function remove(id) {
    const existing = await (0, database_1.queryOne)('SELECT id FROM "Crime" WHERE id = $1', [id]);
    if (!existing) {
        throw new http_error_js_1.HttpError(404, `Crime with ID ${id} not found`);
    }
    await (0, database_1.query)('DELETE FROM "Crime" WHERE id = $1', [id]);
}
async function findByArea(area) {
    const crimes = await (0, database_1.query)(`SELECT * FROM "Crime" WHERE area ILIKE $1 ORDER BY "createdAt" DESC`, [`%${area}%`]);
    const ids = crimes.map((c) => c.id);
    const evMap = await loadEvidenceForCrimes(ids);
    return crimes.map((c) => formatCrime(c, evMap.get(c.id) || []));
}
async function findByCoordinates(latitude, longitude, radiusKm = 5) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
    const crimes = await (0, database_1.query)(`SELECT * FROM "Crime" WHERE
      latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
     ORDER BY "dateTime" DESC`, [latitude - latDelta, latitude + latDelta, longitude - lngDelta, longitude + lngDelta]);
    const ids = crimes.map((c) => c.id);
    const evMap = await loadEvidenceForCrimes(ids);
    return crimes.map((c) => formatCrime(c, evMap.get(c.id) || []));
}
//# sourceMappingURL=crime.js.map