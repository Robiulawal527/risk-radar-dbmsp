import { query, queryOne } from '@risk-radar/database';
import { SOSStatus, type Location, type SOSRequest } from '@risk-radar/types';

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

export async function createSOSRequest(
  userId: string,
  location: Location,
  message?: string
): Promise<SOSRequest> {
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

  if (!sosRequest) throw new Error('Failed to create SOS');
  return formatSOSRequest(sosRequest);
}

export async function updateSOSStatus(id: string, status: SOSStatus): Promise<SOSRequest> {
  const sosRequest =
    status === SOSStatus.RESOLVED
      ? await queryOne<SosRow>(
          `UPDATE "SOSRequest" SET status = $2, "resolvedAt" = NOW() WHERE id = $1 RETURNING *`,
          [id, status]
        )
      : await queryOne<SosRow>(
          `UPDATE "SOSRequest" SET status = $2 WHERE id = $1 RETURNING *`,
          [id, status]
        );

  if (!sosRequest) throw new Error('SOS not found');
  return formatSOSRequest(sosRequest);
}

export async function getActiveSOSRequests(): Promise<SOSRequest[]> {
  const requests = await query<SosRow>(
    `SELECT * FROM "SOSRequest" WHERE status = $1 ORDER BY "createdAt" DESC`,
    [SOSStatus.ACTIVE]
  );

  return requests.map(formatSOSRequest);
}

export async function getUserSOSRequests(userId: string): Promise<SOSRequest[]> {
  const requests = await query<SosRow>(
    `SELECT * FROM "SOSRequest" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [userId]
  );

  return requests.map(formatSOSRequest);
}
