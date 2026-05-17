export enum CrimeType {
  THEFT = 'THEFT',
  ROBBERY = 'ROBBERY',
  ASSAULT = 'ASSAULT',
  BURGLARY = 'BURGLARY',
  FRAUD = 'FRAUD',
  VANDALISM = 'VANDALISM',
  HARASSMENT = 'HARASSMENT',
  OTHER = 'OTHER',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SOSStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface Crime {
  id: string;
  type: CrimeType;
  category: CrimeType;
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    area?: string;
    district?: string;
    division?: string;
  };
  severity: Severity;
  reportedBy: string;
  status: string;
  criminalInfo?: any[];
  dateTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  alertLatitude?: number | null;
  alertLongitude?: number | null;
  alertsEnabled?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  skills?: string[];
}

export interface SOSRequest {
  id: string;
  userId: string;
  location: any;
  status: SOSStatus;
  message?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface AreaRanking {
  rank: number;
  area: string;
  district: string;
  crimeCount: number;
  riskLevel: Severity;
  crimeTypes: Record<CrimeType, number>;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface CriminalRanking {
  rank: number;
  criminalInfo: {
    name: string;
    age?: number;
    gender?: string;
    knownAliases: string[];
    description: string;
    photoUrl?: string;
    status: string;
  };
  crimeCount: number;
  mostFrequentCrime: CrimeType;
  dangerLevel: Severity;
}

export interface PhilanthropistRanking {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  reportsSubmitted: number;
  accuracy: number;
  contribution: number;
}

export interface SocialRadarMatch {
  userId: string;
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  interests: string[];
  skills: string[];
  crimeScore: number;
  goodWorkScore: number;
  trustScore: number;
  compatibilityScore: number;
  totalCrimeRecords: number;
  totalGoodWorkRecords: number;
}

export interface DashboardStats {
  totalCrimes: number;
  crimesByType: Record<CrimeType, number>;
  crimesBySeverity: Record<Severity, number>;
  crimesByArea: Array<{
    area: string;
    count: number;
    riskLevel: Severity;
  }>;
  trends: Array<{
    date: string;
    count: number;
    crimeType?: CrimeType;
  }>;
}
