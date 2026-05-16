import { query, queryOne } from '@risk-radar/database';
import { SOSStatus, type Location, type SOSRequest } from '@risk-radar/types';
import { HttpError } from '../lib/http-error.js';

type SosRow = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  address: string | null;
  area: string | null;
  district: string | null;
  division: string | null;
  message: string | null;
  contacts: unknown;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

/** Converts the database SOS row into the shared API shape used by mobile and web clients. */
function formatSOSRequest(request: SosRow): SOSRequest {
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
    status: request.status as SOSStatus,
    message: request.message ?? undefined,
    contacts: request.contacts as any[],
    createdAt: request.createdAt,
    resolvedAt: request.resolvedAt ?? undefined,
  };
}

/** Creates a new active SOS row after validating GPS coordinates so bad client payloads never hit the database. */
export async function createSOSRequest(
  userId: string,
  location: Location,
  message?: string
): Promise<SOSRequest> {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
    throw new HttpError(400, 'A valid SOS location is required');
  }

  const sosRequest = await queryOne<SosRow>(
    `INSERT INTO "SOSRequest" (
      "userId", latitude, longitude, address, area, district, division, message, contacts, status, "createdAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())
    RETURNING *`,
    [
      userId,
      location.latitude,
      location.longitude,
      location.address ?? null,
      location.area ?? null,
      location.district ?? null,
      location.division ?? null,
      message ?? null,
      JSON.stringify([]),
      SOSStatus.ACTIVE,
    ]
  );

  if (!sosRequest) throw new HttpError(500, 'Failed to create SOS');
  return formatSOSRequest(sosRequest);
}

/** Updates one owned SOS request only; status changes from other users return 404 to avoid leaking alert ids. */
export async function updateSOSStatus(id: string, userId: string, status: SOSStatus | string): Promise<SOSRequest> {
  const allowedStatuses = new Set(Object.values(SOSStatus));
  const normalizedStatus = String(status).toUpperCase() as SOSStatus;
  if (!allowedStatuses.has(normalizedStatus)) {
    throw new HttpError(400, 'Invalid SOS status');
  }

  const sosRequest = await queryOne<SosRow>(
    `UPDATE "SOSRequest"
     SET status = $3,
         "resolvedAt" = CASE
           WHEN $3 IN ($4, $5) THEN COALESCE("resolvedAt", NOW())
           ELSE NULL
         END
     WHERE id = $1 AND "userId" = $2
     RETURNING *`,
    [id, userId, normalizedStatus, SOSStatus.RESOLVED, SOSStatus.CANCELLED]
  );

  if (!sosRequest) throw new HttpError(404, 'SOS not found');
  return formatSOSRequest(sosRequest);
}

/** Soft-deletes an active SOS by resolving it, which removes it from live maps without losing the safety audit trail. */
export async function resolveSOSRequest(id: string, userId: string): Promise<SOSRequest> {
  return updateSOSStatus(id, userId, SOSStatus.RESOLVED);
}

/** Loads only active SOS rows for live maps and notification fan-out. */
export async function getActiveSOSRequests(): Promise<SOSRequest[]> {
  const requests = await query<SosRow>(
    `SELECT * FROM "SOSRequest" WHERE status = $1 ORDER BY "createdAt" DESC`,
    [SOSStatus.ACTIVE]
  );

  return requests.map(formatSOSRequest);
}

/** Loads the current user's full SOS history, including resolved items for the activity timeline. */
export async function getUserSOSRequests(userId: string): Promise<SOSRequest[]> {
  const requests = await query<SosRow>(
    `SELECT * FROM "SOSRequest" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [userId]
  );

  return requests.map(formatSOSRequest);
}
