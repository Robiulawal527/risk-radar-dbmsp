import { Area, Crime } from './types';

export const getDistanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const earthRadiusKm = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const getAreaRiskScore = (area: Area, crimes: Crime[]) => {
  if (typeof area.risk_score === 'number') return Math.round(area.risk_score);

  const nearby = crimes.filter((crime) => getDistanceKm(area.latitude, area.longitude, crime.latitude, crime.longitude) < 2);
  const recentMultiplier = nearby.filter((crime) => {
    const ageMs = Date.now() - new Date(crime.incident_date).getTime();
    return ageMs < 7 * 24 * 60 * 60 * 1000;
  }).length * 8;
  const severityScore = nearby.reduce((sum, crime) => sum + crime.severity * 4, 0);

  return Math.min(100, Math.round(nearby.length * 3 + severityScore + recentMultiplier));
};

export const getRiskColor = (score: number) => {
  if (score >= 80) return '#991b1b';
  if (score >= 60) return '#dc2626';
  if (score >= 40) return '#f97316';
  if (score >= 20) return '#eab308';
  return '#16a34a';
};

export const findNearestHotspot = (latitude: number, longitude: number, areas: Area[], crimes: Crime[]) => {
  return areas
    .map((area) => ({
      area,
      distanceKm: getDistanceKm(latitude, longitude, area.latitude, area.longitude),
      riskScore: getAreaRiskScore(area, crimes)
    }))
    .filter((item) => item.distanceKm <= 2.5 && item.riskScore >= 60)
    .sort((a, b) => b.riskScore - a.riskScore)[0];
};
