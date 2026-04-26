export type Language = 'en' | 'bn';

export type UserRole = 'user' | 'admin' | 'police';

export type User = {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
};

export type Crime = {
  id: string;
  crime_type_id: string;
  type_name?: string;
  type_name_bn?: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  incident_date: string;
  severity: number;
  status: string;
  area?: string;
  area_bn?: string;
  color?: string;
  caseCount?: number;
};

export type Area = {
  id: string;
  name_en: string;
  name_bn: string;
  district: string;
  division: string;
  latitude: number;
  longitude: number;
  risk_score?: number;
  crime_count?: number;
};

export type CrimeType = {
  id: string;
  name_en: string;
  name_bn: string;
  color: string;
  severity_base: number;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};
