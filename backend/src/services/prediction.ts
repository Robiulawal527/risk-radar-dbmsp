import { query } from '@risk-radar/database';
import type { CrimePrediction, CrimeType, Severity } from '@risk-radar/types';

type PredRow = {
  area: string;
  district: string | null;
  predictedCrimeType: string;
  probability: number;
  riskLevel: string;
  timeFrame: string;
  factors: unknown;
  recommendations: unknown;
};

function mapPrediction(p: PredRow): CrimePrediction {
  return {
    area: p.area,
    district: p.district ?? '',
    predictedCrimeType: p.predictedCrimeType as CrimeType,
    probability: p.probability,
    riskLevel: p.riskLevel as Severity,
    timeFrame: p.timeFrame,
    factors: Array.isArray(p.factors) ? (p.factors as string[]) : [],
    recommendations: Array.isArray(p.recommendations) ? (p.recommendations as string[]) : [],
  };
}

export async function getPredictions(area?: string): Promise<CrimePrediction[]> {
  const params: unknown[] = [];
  let n = 1;
  let where = `"validUntil" >= NOW()`;
  if (area) {
    params.push(`%${area}%`);
    where += ` AND area ILIKE $${n++}`;
  }
  params.push(20);
  const limitSlot = n;

  const predictions = await query<PredRow>(
    `SELECT area, district, "predictedCrimeType", probability, "riskLevel", "timeFrame", factors, recommendations
     FROM "CrimePrediction"
     WHERE ${where}
     ORDER BY probability DESC
     LIMIT $${limitSlot}`,
    params
  );

  return predictions.map(mapPrediction);
}

export async function getPredictionByArea(area: string): Promise<CrimePrediction | null> {
  const prediction = await query<PredRow>(
    `SELECT area, district, "predictedCrimeType", probability, "riskLevel", "timeFrame", factors, recommendations
     FROM "CrimePrediction"
     WHERE area ILIKE $1 AND "validUntil" >= NOW()
     ORDER BY probability DESC
     LIMIT 1`,
    [`%${area}%`]
  );

  if (!prediction.length) return null;
  return mapPrediction(prediction[0]);
}
