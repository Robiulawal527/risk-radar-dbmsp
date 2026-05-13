import { query, queryOne } from '@risk-radar/database';
import type { Crime, CrimeType, PaginatedResponse, Severity } from '@risk-radar/types';
import { HttpError } from '../lib/http-error.js';
import { notifyUsersNearNewCrime } from './nearby-alerts.js';

type CrimeRow = {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string | null;
  area: string | null;
  district: string | null;
  division: string | null;
  severity: string;
  status: string;
  reportedBy: string;
  userId: string;
  victimInfo: unknown;
  criminalInfo: unknown;
  witnesses: unknown;
  dateTime: Date;
  createdAt: Date;
  updatedAt: Date;
};

type EvidenceRow = {
  id: string;
  crimeId: string;
  type: string;
  url: string;
  description: string | null;
  createdAt: Date;
};

function buildListWhere(params: {
  type?: CrimeType;
  severity?: Severity;
  area?: string;
  district?: string;
}): { sql: string; values: unknown[] } {
  const parts = ['c.latitude IS NOT NULL', 'c.longitude IS NOT NULL'];
  const values: unknown[] = [];
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

function formatCrime(crime: CrimeRow, evidence: EvidenceRow[] = []): Crime {
  return {
    id: crime.id,
    type: crime.type as CrimeType,
    category: crime.category as CrimeType,
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
    severity: crime.severity as Severity,
    status: crime.status,
    reportedBy: crime.reportedBy,
    victimInfo: (crime.victimInfo as Record<string, unknown>) || undefined,
    criminalInfo: (crime.criminalInfo as any[]) || [],
    witnesses: (crime.witnesses as string[]) || [],
    evidence: evidence || [],
    dateTime: crime.dateTime,
    createdAt: crime.createdAt,
    updatedAt: crime.updatedAt,
  };
}

async function loadEvidenceForCrimes(crimeIds: string[]): Promise<Map<string, EvidenceRow[]>> {
  if (crimeIds.length === 0) return new Map();
  const rows = await query<EvidenceRow>(
    `SELECT * FROM "Evidence" WHERE "crimeId" = ANY($1::text[])`,
    [crimeIds]
  );
  const map = new Map<string, EvidenceRow[]>();
  for (const e of rows) {
    if (!map.has(e.crimeId)) map.set(e.crimeId, []);
    map.get(e.crimeId)!.push(e);
  }
  return map;
}

export async function findAll(params: {
  page?: number;
  limit?: number;
  type?: CrimeType;
  severity?: Severity;
  area?: string;
  district?: string;
}): Promise<PaginatedResponse<Crime>> {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const skip = (page - 1) * limit;

  const { sql: whereSql, values: whereVals } = buildListWhere({
    type: params.type,
    severity: params.severity,
    area: params.area,
    district: params.district,
  });

  let n = whereVals.length + 1;
  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Crime" c ${whereSql}`,
    whereVals
  );
  const total = Number(countRow?.count || 0);

  const crimes = await query<CrimeRow>(
    `SELECT c.* FROM "Crime" c ${whereSql}
     ORDER BY c."createdAt" DESC
     LIMIT $${n++} OFFSET $${n++}`,
    [...whereVals, limit, skip]
  );

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

export async function findById(id: string): Promise<Crime> {
  const crime = await queryOne<CrimeRow>('SELECT * FROM "Crime" WHERE id = $1', [id]);

  if (!crime) {
    throw new HttpError(404, `Crime with ID ${id} not found`);
  }

  const evMap = await loadEvidenceForCrimes([id]);

  return formatCrime(crime, evMap.get(id) || []);
}

export async function create(data: Partial<Crime>, userId: string): Promise<Crime> {
  const crime = await queryOne<CrimeRow>(
    `INSERT INTO "Crime" (
      type, category, title, description, latitude, longitude, address, area, district, division,
      severity, "reportedBy", "userId", "victimInfo", "criminalInfo", witnesses, "dateTime", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17, NOW(), NOW()
    ) RETURNING *`,
    [
      data.type!,
      data.category || data.type!,
      data.title!,
      data.description!,
      data.location!.latitude,
      data.location!.longitude,
      data.location!.address ?? null,
      data.location!.area ?? null,
      data.location!.district ?? null,
      data.location!.division ?? null,
      data.severity!,
      data.reportedBy!,
      userId,
      JSON.stringify(data.victimInfo || {}),
      JSON.stringify(data.criminalInfo || []),
      JSON.stringify(data.witnesses || []),
      data.dateTime || new Date(),
    ]
  );

  if (!crime) throw new HttpError(500, 'Failed to create crime');

  void notifyUsersNearNewCrime({
    crimeId: crime.id,
    latitude: crime.latitude,
    longitude: crime.longitude,
    title: crime.title,
    area: crime.area,
    reporterUserId: userId,
  }).catch((err) => console.error('nearby alert dispatch failed', err));

  return formatCrime(crime, []);
}

export async function update(id: string, data: Partial<Crime>): Promise<Crime> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM "Crime" WHERE id = $1', [id]);
  if (!existing) {
    throw new HttpError(404, `Crime with ID ${id} not found`);
  }

  const sets: string[] = ['"updatedAt" = NOW()'];
  const values: unknown[] = [];
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
  const crime = await queryOne<CrimeRow>(
    `UPDATE "Crime" SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );

  if (!crime) throw new HttpError(404, `Crime with ID ${id} not found`);

  const evMap = await loadEvidenceForCrimes([id]);
  return formatCrime(crime, evMap.get(id) || []);
}

export async function remove(id: string): Promise<void> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM "Crime" WHERE id = $1', [id]);
  if (!existing) {
    throw new HttpError(404, `Crime with ID ${id} not found`);
  }

  await query('DELETE FROM "Crime" WHERE id = $1', [id]);
}

export async function findByArea(area: string): Promise<Crime[]> {
  const crimes = await query<CrimeRow>(
    `SELECT * FROM "Crime" WHERE area ILIKE $1 ORDER BY "createdAt" DESC`,
    [`%${area}%`]
  );
  const ids = crimes.map((c) => c.id);
  const evMap = await loadEvidenceForCrimes(ids);
  return crimes.map((c) => formatCrime(c, evMap.get(c.id) || []));
}

export async function findByCoordinates(
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<Crime[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

  const crimes = await query<CrimeRow>(
    `SELECT * FROM "Crime" WHERE
      latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
     ORDER BY "dateTime" DESC`,
    [latitude - latDelta, latitude + latDelta, longitude - lngDelta, longitude + lngDelta]
  );

  const ids = crimes.map((c) => c.id);
  const evMap = await loadEvidenceForCrimes(ids);
  return crimes.map((c) => formatCrime(c, evMap.get(c.id) || []));
}
