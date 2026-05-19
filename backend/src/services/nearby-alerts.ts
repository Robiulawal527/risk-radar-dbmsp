import { query } from '@risk-radar/database';
import { NotificationType } from '@risk-radar/types';
import * as notificationService from './notification.js';

/** Default nearby safety radius in kilometers. Override with NEARBY_ALERT_RADIUS_KM. */
function defaultRadiusKm(): number {
  const env = process.env.NEARBY_ALERT_RADIUS_KM;
  if (env && !Number.isNaN(Number(env))) return Number(env);
  return 10;
}

async function findUsersNearPoint(params: {
  latitude: number;
  longitude: number;
  excludeUserId: string;
  radiusKm: number;
}) {
  const { latitude, longitude, excludeUserId, radiusKm } = params;
  return query<{ id: string }>(
    `SELECT u.id
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
       ) <= $4`,
    [excludeUserId, latitude, longitude, radiusKm]
  );
}

async function fanOutNearbyNotification(params: {
  latitude: number;
  longitude: number;
  excludeUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
}) {
  const radiusKm = defaultRadiusKm();
  const rows = await findUsersNearPoint({
    latitude: params.latitude,
    longitude: params.longitude,
    excludeUserId: params.excludeUserId,
    radiusKm,
  });

  for (const row of rows) {
    try {
      await notificationService.createNotification(
        row.id,
        params.type,
        params.title,
        params.message,
        { ...params.data, latitude: params.latitude, longitude: params.longitude, radiusKm }
      );
    } catch (e) {
      console.error('nearby notification fan-out failed for user', row.id, e);
    }
  }
}

/**
 * Notify users who opted in with a saved alert location within `radiusKm` of the new incident.
 * Skips the reporter. Uses Haversine distance in SQL (Postgres).
 */
export async function notifyUsersNearNewCrime(params: {
  crimeId: string;
  latitude: number;
  longitude: number;
  title: string;
  area: string | null | undefined;
  reporterUserId: string;
}): Promise<void> {
  const radiusKm = defaultRadiusKm();
  const place = params.area?.trim() || 'Nearby';
  await fanOutNearbyNotification({
    latitude: params.latitude,
    longitude: params.longitude,
    excludeUserId: params.reporterUserId,
    type: NotificationType.CRIME_ALERT,
    title: 'New incident near your area',
    message: `${params.title} — reported in ${place} (within ~${radiusKm.toFixed(1)} km of your alert area).`,
    data: { crimeId: params.crimeId },
  });
}

/** Notify nearby opted-in users when a live SOS is created. */
export async function notifyUsersNearNewSos(params: {
  sosId: string;
  latitude: number;
  longitude: number;
  message: string | null | undefined;
  senderUserId: string;
}): Promise<void> {
  const radiusKm = defaultRadiusKm();
  await fanOutNearbyNotification({
    latitude: params.latitude,
    longitude: params.longitude,
    excludeUserId: params.senderUserId,
    type: NotificationType.SOS_UPDATE,
    title: 'Live SOS near your area',
    message: `${params.message?.trim() || 'Emergency assistance requested'} (within ~${radiusKm.toFixed(1)} km of your alert area).`,
    data: { sosId: params.sosId, liveLocation: true },
  });
}
