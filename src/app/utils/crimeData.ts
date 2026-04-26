import {
  bangladeshCrimeLocations,
  bangladeshCrimeRecords,
  bangladeshCrimeSource,
  bangladeshCrimeTypes,
} from '../data/bangladeshCrimeStats';

export const crimeTypes = bangladeshCrimeTypes.map((type) => ({
  id: type.id,
  name: type.name,
  namebn: type.namebn,
  color: type.color,
  severity: type.severity,
}));

export const bangladeshAreas = bangladeshCrimeLocations.map((area) => ({
  name: area.name,
  namebn: area.namebn,
  lat: area.lat,
  lng: area.lng,
  riskScore: area.riskScore,
  unit: area.unit,
  district: area.district,
  division: area.division,
  aliases: [...area.aliases],
  latestCaseCount: area.crime_count,
}));

// Backward-compatible export used by existing dashboard components.
export const dhakaAreas = bangladeshAreas;

export interface GeneratedCrime {
  id: string;
  type: string;
  typeName: string;
  typeNameBn: string;
  severity: number;
  lat: number;
  lng: number;
  area: string;
  areaBn: string;
  date: string;
  description: string;
  reportedBy: string;
  status: string;
  victims: number;
  caseCount?: number;
  source?: string;
  unit?: string;
  title?: string;
  color?: string;
}

type DhakaArea = (typeof dhakaAreas)[number];

export const generateCrimeData = (): GeneratedCrime[] => {
  return bangladeshCrimeRecords.map((record) => ({
    id: record.id,
    type: record.type,
    typeName: record.typeName,
    typeNameBn: record.typeNameBn,
    severity: record.severity,
    lat: record.lat,
    lng: record.lng,
    area: record.area,
    areaBn: record.areaBn,
    date: record.date,
    description: record.description,
    reportedBy: record.reportedBy,
    status: record.status,
    victims: record.victims,
    caseCount: record.caseCount,
    source: record.source,
    unit: record.unit,
    title: record.title,
    color: record.color,
  }));
};

// Calculate area risk scores based on crimes
export const calculateAreaRiskScore = (
  area: DhakaArea,
  crimes: GeneratedCrime[],
): number => {
  const areaCrimes = crimes.filter((c) => c.area === area.name);
  if (areaCrimes.length === 0) return area.riskScore;
  
  const totalCases = areaCrimes.reduce((sum, crime) => sum + (crime.caseCount || 1), 0);
  const weightedSeverity = areaCrimes.reduce(
    (sum, crime) => sum + crime.severity * (crime.caseCount || 1),
    0,
  );
  const avgSeverity = totalCases ? weightedSeverity / totalCases : 0;
  
  const score = Math.min(100, avgSeverity * 12 + Math.log10(totalCases + 1) * 14);
  return Math.round(score);
};

export const searchCrimeLocation = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  return bangladeshAreas.find((area) => {
    const candidates = [
      area.name,
      area.namebn,
      area.unit,
      area.district,
      area.division,
      ...area.aliases,
    ];
    return candidates.some((candidate) => candidate.toLowerCase().includes(normalized));
  }) || null;
};

export const crimeDataSource = bangladeshCrimeSource;

// Criminal profiles (mock data)
export const mockCriminals = [
  {
    id: 'crim-1',
    name: 'Redacted Name 1',
    alias: 'The Shadow',
    crimesCommitted: 15,
    lastSeen: 'Mirpur Area',
    status: 'Wanted',
    dangerLevel: 5,
  },
  {
    id: 'crim-2',
    name: 'Redacted Name 2',
    alias: 'Night Rider',
    crimesCommitted: 12,
    lastSeen: 'Old Dhaka',
    status: 'Wanted',
    dangerLevel: 4,
  },
  {
    id: 'crim-3',
    name: 'Redacted Name 3',
    alias: 'Silent Wolf',
    crimesCommitted: 10,
    lastSeen: 'Jatrabari',
    status: 'Arrested',
    dangerLevel: 4,
  },
  {
    id: 'crim-4',
    name: 'Redacted Name 4',
    alias: 'Quick Hand',
    crimesCommitted: 8,
    lastSeen: 'Kamrangirchar',
    status: 'Wanted',
    dangerLevel: 3,
  },
  {
    id: 'crim-5',
    name: 'Redacted Name 5',
    alias: 'Smooth Talker',
    crimesCommitted: 7,
    lastSeen: 'Gulshan',
    status: 'Under Investigation',
    dangerLevel: 3,
  },
];

// AI-based crime prediction (mock)
export const predictCrimeHotspots = (crimes: GeneratedCrime[]) => {
  // Group crimes by area
  const areaFrequency: Record<string, number> = {};
  crimes.forEach((crime) => {
    areaFrequency[crime.area] = (areaFrequency[crime.area] || 0) + (crime.caseCount || 1);
  });
  
  // Get top 5 areas with highest crime frequency
  const predictions = Object.entries(areaFrequency)
    .map(([area, count]) => ({
      area,
      predictedRisk: Math.min(100, count * 2),
      confidence: Math.floor(Math.random() * 20) + 75, // 75-95%
    }))
    .sort((a, b) => b.predictedRisk - a.predictedRisk)
    .slice(0, 5);
  
  return predictions;
};

// Safe route calculation (simplified)
export const calculateSafeRoute = (
  start: string,
  end: string,
  _crimes: GeneratedCrime[],
) => {
  // In a real app, this would use routing API with crime data overlay
  return {
    routes: [
      {
        id: 'route-1',
        name: 'Safest Route',
        distance: '8.5 km',
        duration: '25 min',
        riskScore: 15,
        waypoints: [start, end],
      },
      {
        id: 'route-2',
        name: 'Fastest Route',
        distance: '6.2 km',
        duration: '18 min',
        riskScore: 42,
        waypoints: [start, end],
      },
      {
        id: 'route-3',
        name: 'Balanced Route',
        distance: '7.1 km',
        duration: '22 min',
        riskScore: 28,
        waypoints: [start, end],
      },
    ],
  };
};
