import { query } from '@risk-radar/database';
import { NotificationType } from '@risk-radar/types';
import * as notificationService from './notification.js';

/** Default radius so π·r² ≈ 10 km² (user-requested “~10 km²” patch). Override with NEARBY_ALERT_RADIUS_KM. */
function defaultRadiusKm(): number {
  const env = process.env.NEARBY_ALERT_RADIUS_KM;
  if (env && !Number.isNaN(Number(env))) return Number(env);
  return Math.sqrt(10 / Math.PI);
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
  const { crimeId, latitude, longitude, title, area, reporterUserId } = params;

  const rows = await query<{ id: string }>(
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
    [reporterUserId, latitude, longitude, radiusKm]
  );

  const place = area?.trim() || 'Nearby';
  const msg = `${title} — reported in ${place} (within ~${radiusKm.toFixed(1)} km of your alert area).`;

  for (const row of rows) {
    try {
      await notificationService.createNotification(
        row.id,
        NotificationType.CRIME_ALERT,
        'New incident near your area',
        msg,
        { crimeId, latitude, longitude, radiusKm }
      );
    } catch (e) {
      console.error('notifyUsersNearNewCrime: failed for user', row.id, e);
    }
  }
}
