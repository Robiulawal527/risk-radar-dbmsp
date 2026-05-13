import { query } from '@risk-radar/database';
import { Severity, type HeatmapFilter, type HeatmapPoint } from '@risk-radar/types';

export async function getHeatmapData(filter?: HeatmapFilter): Promise<HeatmapPoint[]> {
  const parts = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
  const params: unknown[] = [];
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
    } else if (filter.dateFrom) {
      parts.push(`"dateTime" >= $${n++}`);
      params.push(filter.dateFrom);
    } else if (filter.dateTo) {
      parts.push(`"dateTime" <= $${n++}`);
      params.push(filter.dateTo);
    }
  }

  if (filter?.areas && filter.areas.length > 0) {
    parts.push(`area = ANY($${n++}::text[])`);
    params.push(filter.areas);
  }

  const where = `WHERE ${parts.join(' AND ')}`;

  const crimes = await query<{ latitude: number; longitude: number; severity: string }>(
    `SELECT latitude, longitude, severity FROM "Crime" ${where}`,
    params
  );

  return crimes
    .filter(
      (c) =>
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !Number.isNaN(c.latitude) &&
        !Number.isNaN(c.longitude)
    )
    .map((crime) => ({
      latitude: crime.latitude,
      longitude: crime.longitude,
      intensity: calculateIntensity(crime.severity as Severity),
    }));
}

function calculateIntensity(severity: Severity): number {
  const intensityMap: Record<Severity, number> = {
    [Severity.LOW]: 0.3,
    [Severity.MEDIUM]: 0.6,
    [Severity.HIGH]: 0.85,
    [Severity.CRITICAL]: 1.0,
  };
  return intensityMap[severity] || 0.5;
}
