"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeatmapData = getHeatmapData;
const database_1 = require("@risk-radar/database");
const types_1 = require("@risk-radar/types");
async function getHeatmapData(filter) {
    const parts = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
    const params = [];
    let n = 1;
    if (filter?.crimeTypes && filter.crimeTypes.length > 0) {
        parts.push(`type = ANY($${n++}::text[])`);
        params.push(filter.crimeTypes);
    }
    if (filter?.severities && filter.severities.length > 0) {
        parts.push(`severity = ANY($${n++}::text[])`);
        params.push(filter.severities);
    }
    if (filter?.dateFrom || filter?.dateTo) {
        if (filter.dateFrom && filter.dateTo) {
            parts.push(`"dateTime" BETWEEN $${n++} AND $${n++}`);
            params.push(filter.dateFrom, filter.dateTo);
        }
        else if (filter.dateFrom) {
            parts.push(`"dateTime" >= $${n++}`);
            params.push(filter.dateFrom);
        }
        else if (filter.dateTo) {
            parts.push(`"dateTime" <= $${n++}`);
            params.push(filter.dateTo);
        }
    }
    if (filter?.areas && filter.areas.length > 0) {
        parts.push(`area = ANY($${n++}::text[])`);
        params.push(filter.areas);
    }
    const where = `WHERE ${parts.join(' AND ')}`;
    const crimes = await (0, database_1.query)(`SELECT latitude, longitude, severity FROM "Crime" ${where}`, params);
    return crimes
        .filter((c) => typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !Number.isNaN(c.latitude) &&
        !Number.isNaN(c.longitude))
        .map((crime) => ({
        latitude: crime.latitude,
        longitude: crime.longitude,
        intensity: calculateIntensity(crime.severity),
    }));
}
function calculateIntensity(severity) {
    const intensityMap = {
        [types_1.Severity.LOW]: 0.3,
        [types_1.Severity.MEDIUM]: 0.6,
        [types_1.Severity.HIGH]: 0.85,
        [types_1.Severity.CRITICAL]: 1.0,
    };
    return intensityMap[severity] || 0.5;
}
//# sourceMappingURL=heatmap.js.map