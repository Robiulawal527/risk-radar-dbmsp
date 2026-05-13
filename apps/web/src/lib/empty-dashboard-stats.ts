import { CrimeType, Severity, type DashboardStats } from '@/lib/types';

export function emptyDashboardStats(): DashboardStats {
  const crimesByType = Object.values(CrimeType).reduce(
    (acc, t) => {
      acc[t] = 0;
      return acc;
    },
    {} as Record<CrimeType, number>
  );
  const crimesBySeverity = Object.values(Severity).reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<Severity, number>
  );
  return {
    totalCrimes: 0,
    crimesByType,
    crimesBySeverity,
    crimesByArea: [],
    trends: [],
  };
}
