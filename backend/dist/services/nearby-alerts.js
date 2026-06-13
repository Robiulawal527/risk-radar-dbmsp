"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUsersNearNewCrime = notifyUsersNearNewCrime;
exports.notifyUsersNearNewSos = notifyUsersNearNewSos;
const database_1 = require("@risk-radar/database");
const types_1 = require("@risk-radar/types");
const notificationService = __importStar(require("./notification.js"));
/** Default nearby safety radius in kilometers. Override with NEARBY_ALERT_RADIUS_KM. */
function defaultRadiusKm() {
    const env = process.env.NEARBY_ALERT_RADIUS_KM;
    if (env && !Number.isNaN(Number(env)))
        return Number(env);
    return 10;
}
async function findUsersNearPoint(params) {
    const { latitude, longitude, excludeUserId, radiusKm } = params;
    return (0, database_1.query)(`SELECT u.id
     FROM "User" u
     WHERE u."alertsEnabled" = true
       AND u."alertLatitude" IS NOT NULL
       AND u."alertLongitude" IS NOT NULL
       AND u.id <> $1
       AND (
         6371 * 2 * asin(
           sqrt(
             power(sin(radians($2 - u."alertLatitude") / 2), 2)
             + cos(radians(u."alertLatitude")) * cos(radians($2))
             * power(sin(radians($3 - u."alertLongitude") / 2), 2)
           )
         )
       ) <= $4`, [excludeUserId, latitude, longitude, radiusKm]);
}
async function fanOutNearbyNotification(params) {
    const radiusKm = defaultRadiusKm();
    const rows = await findUsersNearPoint({
        latitude: params.latitude,
        longitude: params.longitude,
        excludeUserId: params.excludeUserId,
        radiusKm,
    });
    for (const row of rows) {
        try {
            await notificationService.createNotification(row.id, params.type, params.title, params.message, { ...params.data, latitude: params.latitude, longitude: params.longitude, radiusKm });
        }
        catch (e) {
            console.error('nearby notification fan-out failed for user', row.id, e);
        }
    }
}
/**
 * Notify users who opted in with a saved alert location within `radiusKm` of the new incident.
 * Skips the reporter. Uses Haversine distance in SQL (Postgres).
 */
async function notifyUsersNearNewCrime(params) {
    const radiusKm = defaultRadiusKm();
    const place = params.area?.trim() || 'Nearby';
    await fanOutNearbyNotification({
        latitude: params.latitude,
        longitude: params.longitude,
        excludeUserId: params.reporterUserId,
        type: types_1.NotificationType.CRIME_ALERT,
        title: 'New incident near your area',
        message: `${params.title} — reported in ${place} (within ~${radiusKm.toFixed(1)} km of your alert area).`,
        data: { crimeId: params.crimeId },
    });
}
/** Notify nearby opted-in users when a live SOS is created. */
async function notifyUsersNearNewSos(params) {
    const radiusKm = defaultRadiusKm();
    await fanOutNearbyNotification({
        latitude: params.latitude,
        longitude: params.longitude,
        excludeUserId: params.senderUserId,
        type: types_1.NotificationType.SOS_UPDATE,
        title: 'Live SOS near your area',
        message: `${params.message?.trim() || 'Emergency assistance requested'} (within ~${radiusKm.toFixed(1)} km of your alert area).`,
        data: { sosId: params.sosId, liveLocation: true },
    });
}
//# sourceMappingURL=nearby-alerts.js.map