"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSOSRequest = createSOSRequest;
exports.updateSOSStatus = updateSOSStatus;
exports.resolveSOSRequest = resolveSOSRequest;
exports.getActiveSOSRequests = getActiveSOSRequests;
exports.getUserSOSRequests = getUserSOSRequests;
const database_1 = require("@risk-radar/database");
const types_1 = require("@risk-radar/types");
const http_error_js_1 = require("../lib/http-error.js");
/** Converts the database SOS row into the shared API shape used by mobile and web clients. */
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
/** Creates a new active SOS row after validating GPS coordinates so bad client payloads never hit the database. */
async function createSOSRequest(userId, location, message) {
    if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
        throw new http_error_js_1.HttpError(400, 'A valid SOS location is required');
    }
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
        throw new http_error_js_1.HttpError(500, 'Failed to create SOS');
    return formatSOSRequest(sosRequest);
}
/** Updates one owned SOS request only; status changes from other users return 404 to avoid leaking alert ids. */
async function updateSOSStatus(id, userId, status) {
    const allowedStatuses = new Set(Object.values(types_1.SOSStatus));
    const normalizedStatus = String(status).toUpperCase();
    if (!allowedStatuses.has(normalizedStatus)) {
        throw new http_error_js_1.HttpError(400, 'Invalid SOS status');
    }
    const sosRequest = await (0, database_1.queryOne)(`UPDATE "SOSRequest"
     SET status = $3,
         "resolvedAt" = CASE
           WHEN $3 IN ($4, $5) THEN COALESCE("resolvedAt", NOW())
           ELSE NULL
         END
     WHERE id = $1 AND "userId" = $2
     RETURNING *`, [id, userId, normalizedStatus, types_1.SOSStatus.RESOLVED, types_1.SOSStatus.CANCELLED]);
    if (!sosRequest)
        throw new http_error_js_1.HttpError(404, 'SOS not found');
    return formatSOSRequest(sosRequest);
}
/** Soft-deletes an active SOS by resolving it, which removes it from live maps without losing the safety audit trail. */
async function resolveSOSRequest(id, userId) {
    return updateSOSStatus(id, userId, types_1.SOSStatus.RESOLVED);
}
/** Loads only active SOS rows for live maps and notification fan-out. */
async function getActiveSOSRequests() {
    const requests = await (0, database_1.query)(`SELECT * FROM "SOSRequest" WHERE status = $1 ORDER BY "createdAt" DESC`, [types_1.SOSStatus.ACTIVE]);
    return requests.map(formatSOSRequest);
}
/** Loads the current user's full SOS history, including resolved items for the activity timeline. */
async function getUserSOSRequests(userId) {
    const requests = await (0, database_1.query)(`SELECT * FROM "SOSRequest" WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
    return requests.map(formatSOSRequest);
}
//# sourceMappingURL=sos.js.map