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

export enum NotificationType {
  CRIME_ALERT = 'CRIME_ALERT',
  SOS_UPDATE = 'SOS_UPDATE',
  SYSTEM = 'SYSTEM',
  COMMUNITY = 'COMMUNITY',
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  role?: UserRole;
  /** When set with `alertLongitude`, user receives CRIME_ALERT notifications for new incidents within the configured radius. */
  alertLatitude?: number | null;
  alertLongitude?: number | null;
  alertsEnabled?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  district?: string;
  division?: string;
}

export interface Crime {
  id: string;
  type: CrimeType;
  category: CrimeType;
  title: string;
  description: string;
  location: Location;
  severity: Severity;
  status: string;
  reportedBy: string;
  victimInfo?: Record<string, unknown>;
  criminalInfo?: any[];
  witnesses?: string[];
  evidence?: any[];
  dateTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SOSRequest {
  id: string;
  userId: string;
  location: Location;
  status: SOSStatus;
  message?: string;
  contacts?: any[];
  createdAt: Date;
  resolvedAt?: Date;
}

export interface CrimePrediction {
  area: string;
  district: string;
  predictedCrimeType: CrimeType;
  probability: number;
  riskLevel: Severity;
  timeFrame: string;
  factors: string[];
  recommendations: string[];
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
}

export interface HeatmapFilter {
  crimeTypes?: CrimeType[];
  severities?: Severity[];
  dateFrom?: Date;
  dateTo?: Date;
  areas?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CrimeStats {
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
  }>;
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

export interface CriminalInfo {
  name: string;
  age?: number;
  gender?: string;
  description: string;
  knownAliases: string[];
  photoUrl?: string;
  status: string;
}

export interface CriminalRanking {
  rank: number;
  criminalInfo: CriminalInfo;
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

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}
