import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, Area, Crime, CrimeType, User } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const storageKeys = {
  token: 'risk-radar-token',
  user: 'risk-radar-user'
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
  const token = await AsyncStorage.getItem(storageKeys.token);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
};

export const authApi = {
  async hydrate() {
    const user = await AsyncStorage.getItem(storageKeys.user);
    return user ? (JSON.parse(user) as User) : null;
  },
  async login(email: string, password: string) {
    const response = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    await AsyncStorage.multiSet([
      [storageKeys.token, response.data.token],
      [storageKeys.user, JSON.stringify(response.data.user)]
    ]);
    return response.data.user;
  },
  async signup(fullName: string, email: string, password: string) {
    const response = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password })
    });
    await AsyncStorage.multiSet([
      [storageKeys.token, response.data.token],
      [storageKeys.user, JSON.stringify(response.data.user)]
    ]);
    return response.data.user;
  },
  async logout() {
    await AsyncStorage.multiRemove([storageKeys.token, storageKeys.user]);
  }
};

export const crimeApi = {
  crimes: (filters = '') => request<Crime[]>(`/crimes${filters}`),
  types: () => request<CrimeType[]>('/crimes/types'),
  nearby: (latitude: number, longitude: number, radius = 3) =>
    request<Crime[]>(`/crimes/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`),
  create: (payload: unknown) =>
    request<Crime>('/crimes', { method: 'POST', body: JSON.stringify(payload) })
};

export const areaApi = {
  all: () => request<Area[]>('/areas'),
  highRisk: () => request<Area[]>('/areas/risk/high')
};

export const analyticsApi = {
  stats: () => request<{
    overview: Record<string, string | number | null>;
    byType: Array<Record<string, string | number>>;
    monthlyTrend: Array<Record<string, string | number>>;
  }>('/analytics/stats'),
  predictions: () => request<Array<Record<string, string | number>>>('/analytics/predictions')
};

export const emergencyApi = {
  sos: (latitude: number, longitude: number, emergencyType: string, message: string) =>
    request('/emergency/sos', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, emergencyType, message })
    })
};

export const profileApi = {
  criminalRanking: () => request<Array<Record<string, string | number | null>>>('/profiles/criminals/ranking'),
  volunteerMe: () => request<Record<string, unknown> | null>('/profiles/volunteers/me'),
  updateVolunteer: (payload: unknown) =>
    request<Record<string, unknown>>('/profiles/volunteers/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
};
