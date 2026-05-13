"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSOSRequest = createSOSRequest;
exports.updateSOSStatus = updateSOSStatus;
exports.getActiveSOSRequests = getActiveSOSRequests;
exports.getUserSOSRequests = getUserSOSRequests;
const database_1 = require("@risk-radar/database");
const types_1 = require("@risk-radar/types");
function formatSOSRequest(request) {
    return {
        id: request.id,
        userId: request.userId,
        location: {
            latitude: request.latitude,
            longitude: request.longitude,
            address: request.address ?? undefined,
            area: request.area ?? undefined,
            district: request.district ?? undefined,
            division: request.division ?? undefined,
        },
        status: request.status,
        message: request.message ?? undefined,
        contacts: request.contacts,
        createdAt: request.createdAt,
        resolvedAt: request.resolvedAt ?? undefined,
    };
}
async function createSOSRequest(userId, location, message) {
    const sosRequest = await (0, database_1.queryOne)(`INSERT INTO "SOSRequest" (
      "userId", latitude, longitude, address, area, district, division, message, contacts, status, "createdAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())
    RETURNING *`, [
        userId,
        location.latitude,
        location.longitude,
        location.address ?? null,
        location.area ?? null,
        location.district ?? null,
        location.division ?? null,
        message ?? null,
        JSON.stringify([]),
        types_1.SOSStatus.ACTIVE,
    ]);
    if (!sosRequest)
        throw new Error('Failed to create SOS');
    return formatSOSRequest(sosRequest);
}
async function updateSOSStatus(id, status) {
    const sosRequest = status === types_1.SOSStatus.RESOLVED
        ? await (0, database_1.queryOne)(`UPDATE "SOSRequest" SET status = $2, "resolvedAt" = NOW() WHERE id = $1 RETURNING *`, [id, status])
        : await (0, database_1.queryOne)(`UPDATE "SOSRequest" SET status = $2 WHERE id = $1 RETURNING *`, [id, status]);
    if (!sosRequest)
        throw new Error('SOS not found');
    return formatSOSRequest(sosRequest);
}
async function getActiveSOSRequests() {
    const requests = await (0, database_1.query)(`SELECT * FROM "SOSRequest" WHERE status = $1 ORDER BY "createdAt" DESC`, [types_1.SOSStatus.ACTIVE]);
    return requests.map(formatSOSRequest);
}
async function getUserSOSRequests(userId) {
    const requests = await (0, database_1.query)(`SELECT * FROM "SOSRequest" WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
    return requests.map(formatSOSRequest);
}
//# sourceMappingURL=sos.js.map