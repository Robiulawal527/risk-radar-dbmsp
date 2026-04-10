// API Service with Mock Backend for Development
// This allows the app to work without a real backend server

import config from '../config/env';

const USE_MOCK_API = true; // Set to false when real backend is available
const API_URL = config.apiUrl;

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_USERS = [
  {
    id: '1',
    email: 'admin@riskradar.bd',
    password: 'admin123',
    fullName: 'Admin User',
    phone: '+880 1712-345678',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'police@riskradar.bd',
    password: 'police123',
    fullName: 'Police Officer',
    phone: '+880 1812-345678',
    role: 'police',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    email: 'user@riskradar.bd',
    password: 'user123',
    fullName: 'Regular User',
    phone: '+880 1912-345678',
    role: 'user',
    createdAt: new Date().toISOString(),
  },
];

const MOCK_CRIME_TYPES = [
  { id: '1', name: 'Theft', color: '#f59e0b', severity: 2 },
  { id: '2', name: 'Robbery', color: '#dc2626', severity: 4 },
  { id: '3', name: 'Assault', color: '#ef4444', severity: 3 },
  { id: '4', name: 'Burglary', color: '#f97316', severity: 3 },
  { id: '5', name: 'Vandalism', color: '#eab308', severity: 2 },
  { id: '6', name: 'Vehicle Theft', color: '#dc2626', severity: 3 },
  { id: '7', name: 'Harassment', color: '#f59e0b', severity: 2 },
  { id: '8', name: 'Drug-Related', color: '#dc2626', severity: 4 },
];

const MOCK_CRIMES = [
  {
    id: '1',
    latitude: 23.8103,
    longitude: 90.4125,
    crime_type_id: '1',
    type_name: 'Theft',
    severity: 2,
    title: 'Mobile Phone Snatching',
    description: 'Two persons on motorcycle snatched mobile phone from pedestrian',
    incident_date: '2024-04-08T15:30:00Z',
    area_id: '1',
    area_name: 'Gulshan',
    status: 'reported',
    reported_by: '3',
    color: '#f59e0b',
  },
  {
    id: '2',
    latitude: 23.7808,
    longitude: 90.4156,
    crime_type_id: '2',
    type_name: 'Robbery',
    severity: 4,
    title: 'Armed Robbery at Shop',
    description: 'Armed robbery at local shop, 3 suspects fled the scene',
    incident_date: '2024-04-07T22:45:00Z',
    area_id: '2',
    area_name: 'Dhanmondi',
    status: 'investigating',
    reported_by: '2',
    color: '#dc2626',
  },
  {
    id: '3',
    latitude: 23.7465,
    longitude: 90.3769,
    crime_type_id: '3',
    type_name: 'Assault',
    severity: 3,
    title: 'Physical Assault',
    description: 'Assault incident near park area',
    incident_date: '2024-04-08T19:20:00Z',
    area_id: '3',
    area_name: 'Mirpur',
    status: 'reported',
    reported_by: '3',
    color: '#ef4444',
  },
  {
    id: '4',
    latitude: 23.7289,
    longitude: 90.3982,
    crime_type_id: '4',
    type_name: 'Burglary',
    severity: 3,
    title: 'House Burglary',
    description: 'Residential house burglary when owners were away',
    incident_date: '2024-04-06T03:15:00Z',
    area_id: '3',
    area_name: 'Mirpur',
    status: 'resolved',
    reported_by: '3',
    color: '#f97316',
  },
  {
    id: '5',
    latitude: 23.8584,
    longitude: 90.3967,
    crime_type_id: '1',
    type_name: 'Theft',
    severity: 2,
    title: 'Pickpocketing',
    description: 'Wallet stolen in crowded market area',
    incident_date: '2024-04-08T11:00:00Z',
    area_id: '4',
    area_name: 'Uttara',
    status: 'reported',
    reported_by: '3',
    color: '#f59e0b',
  },
];

const MOCK_AREAS = [
  {
    id: '1',
    area_name: 'Gulshan',
    district: 'Dhaka',
    risk_level: 2,
    crime_count: 45,
    population: 150000,
    area_km2: 8.5,
    latitude: 23.7937,
    longitude: 90.4066,
  },
  {
    id: '2',
    area_name: 'Dhanmondi',
    district: 'Dhaka',
    risk_level: 3,
    crime_count: 68,
    population: 200000,
    area_km2: 10.2,
    latitude: 23.7461,
    longitude: 90.3742,
  },
  {
    id: '3',
    area_name: 'Mirpur',
    district: 'Dhaka',
    risk_level: 4,
    crime_count: 92,
    population: 500000,
    area_km2: 25.3,
    latitude: 23.8223,
    longitude: 90.3654,
  },
  {
    id: '4',
    area_name: 'Uttara',
    district: 'Dhaka',
    risk_level: 2,
    crime_count: 38,
    population: 300000,
    area_km2: 15.8,
    latitude: 23.8759,
    longitude: 90.3795,
  },
];

const MOCK_STATS = {
  totalCrimes: 247,
  crimeToday: 12,
  crimeThisWeek: 45,
  crimeThisMonth: 189,
  highRiskAreas: 3,
  totalAreas: 15,
  resolvedCrimes: 156,
  activeSOS: 2,
  crimesByType: [
    { type: 'Theft', count: 89, percentage: 36 },
    { type: 'Robbery', count: 45, percentage: 18 },
    { type: 'Assault', count: 38, percentage: 15 },
    { type: 'Burglary', count: 32, percentage: 13 },
    { type: 'Vandalism', count: 25, percentage: 10 },
    { type: 'Vehicle Theft', count: 18, percentage: 8 },
  ],
  crimesByMonth: [
    { month: 'Jan', count: 45 },
    { month: 'Feb', count: 52 },
    { month: 'Mar', count: 61 },
    { month: 'Apr', count: 89 },
  ],
};

// ============================================================================
// MOCK API IMPLEMENTATION
// ============================================================================

const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

const mockResponse = async <T>(data: T, success: boolean = true): Promise<any> => {
  await delay();
  return {
    success,
    data,
    message: success ? 'Success' : 'Error',
  };
};

// Helper function to get auth token
const getToken = (): string | null => {
  return localStorage.getItem('token');
};

// Helper function to get current user
const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Store mock data in localStorage
const initializeMockData = () => {
  if (!localStorage.getItem('mock_crimes')) {
    localStorage.setItem('mock_crimes', JSON.stringify(MOCK_CRIMES));
  }
  if (!localStorage.getItem('mock_areas')) {
    localStorage.setItem('mock_areas', JSON.stringify(MOCK_AREAS));
  }
};

// Get crimes from localStorage
const getMockCrimes = () => {
  const crimes = localStorage.getItem('mock_crimes');
  return crimes ? JSON.parse(crimes) : MOCK_CRIMES;
};

// Save crimes to localStorage
const saveMockCrimes = (crimes: any[]) => {
  localStorage.setItem('mock_crimes', JSON.stringify(crimes));
};

// Initialize mock data
initializeMockData();

// Helper function to make real API requests
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Authentication API
export const authAPI = {
  register: async (userData: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    }

    // Mock implementation
    const existingUser = MOCK_USERS.find(u => u.email === userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const newUser = {
      id: String(MOCK_USERS.length + 1),
      email: userData.email,
      fullName: userData.fullName,
      phone: userData.phone || '',
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    const token = `mock_token_${newUser.id}_${Date.now()}`;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(newUser));

    return mockResponse({
      user: newUser,
      token,
    });
  },

  login: async (email: string, password: string) => {
    if (!USE_MOCK_API) {
      const data = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      if (data.success && data.data.token) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      
      return data;
    }

    // Mock implementation
    await delay();
    
    // Trim and lowercase email for comparison
    const normalizedEmail = email.trim().toLowerCase();
    
    const user = MOCK_USERS.find(u => 
      u.email.toLowerCase() === normalizedEmail && u.password === password
    );
    
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const { password: _, ...userWithoutPassword } = user;
    const token = `mock_token_${user.id}_${Date.now()}`;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userWithoutPassword));

    return {
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
      message: 'Login successful',
    };
  },

  getMe: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/auth/me');
    }

    const user = getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    return mockResponse(user);
  },

  updateProfile: async (profileData: any) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
    }

    const user = getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const updatedUser = { ...user, ...profileData };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    return mockResponse(updatedUser);
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  },
};

// Crime API
export const crimeAPI = {
  getCrimes: async (filters?: any) => {
    if (!USE_MOCK_API) {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }
      return fetchWithAuth(`/crimes?${params.toString()}`);
    }

    let crimes = getMockCrimes();

    // Apply filters
    if (filters?.type) {
      crimes = crimes.filter((c: any) => c.crime_type_id === filters.type);
    }
    if (filters?.area) {
      crimes = crimes.filter((c: any) => c.area_id === filters.area);
    }
    if (filters?.severity) {
      crimes = crimes.filter((c: any) => c.severity >= filters.severity);
    }

    return mockResponse(crimes);
  },

  getCrimeById: async (id: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/crimes/${id}`);
    }

    const crimes = getMockCrimes();
    const crime = crimes.find((c: any) => c.id === id);
    
    if (!crime) {
      throw new Error('Crime not found');
    }

    return mockResponse(crime);
  },

  createCrime: async (crimeData: any) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/crimes', {
        method: 'POST',
        body: JSON.stringify(crimeData),
      });
    }

    const crimes = getMockCrimes();
    const crimeType = MOCK_CRIME_TYPES.find(t => t.id === crimeData.crime_type_id);
    
    const newCrime = {
      id: String(crimes.length + 1),
      ...crimeData,
      type_name: crimeType?.name || 'Unknown',
      severity: crimeType?.severity || 1,
      color: crimeType?.color || '#f59e0b',
      status: 'reported',
      incident_date: new Date().toISOString(),
      reported_by: getCurrentUser()?.id,
    };

    crimes.push(newCrime);
    saveMockCrimes(crimes);

    return mockResponse(newCrime);
  },

  updateCrime: async (id: string, crimeData: any) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/crimes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(crimeData),
      });
    }

    const crimes = getMockCrimes();
    const index = crimes.findIndex((c: any) => c.id === id);
    
    if (index === -1) {
      throw new Error('Crime not found');
    }

    crimes[index] = { ...crimes[index], ...crimeData };
    saveMockCrimes(crimes);

    return mockResponse(crimes[index]);
  },

  deleteCrime: async (id: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/crimes/${id}`, {
        method: 'DELETE',
      });
    }

    const crimes = getMockCrimes();
    const filtered = crimes.filter((c: any) => c.id !== id);
    saveMockCrimes(filtered);

    return mockResponse({ deleted: true });
  },

  getCrimeTypes: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/crimes/types');
    }

    return mockResponse(MOCK_CRIME_TYPES);
  },

  getCrimesNearby: async (lat: number, lng: number, radius: number = 5) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/crimes/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
    }

    // Simple distance calculation
    const crimes = getMockCrimes();
    const nearby = crimes.filter((crime: any) => {
      const distance = Math.sqrt(
        Math.pow(crime.latitude - lat, 2) + Math.pow(crime.longitude - lng, 2)
      );
      return distance <= radius / 111; // Rough conversion to degrees
    });

    return mockResponse(nearby);
  },
};

// Area API
export const areaAPI = {
  getAreas: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/areas');
    }

    return mockResponse(MOCK_AREAS);
  },

  getAreaById: async (id: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/areas/${id}`);
    }

    const area = MOCK_AREAS.find(a => a.id === id);
    if (!area) {
      throw new Error('Area not found');
    }

    return mockResponse(area);
  },

  getHighRiskAreas: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/areas/risk/high');
    }

    const highRisk = MOCK_AREAS.filter(a => a.risk_level >= 3);
    return mockResponse(highRisk);
  },
};

// Analytics API
export const analyticsAPI = {
  getStats: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/analytics/stats');
    }

    return mockResponse(MOCK_STATS);
  },

  getAreaStats: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/analytics/areas');
    }

    return mockResponse(MOCK_AREAS);
  },

  getPredictions: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/analytics/predictions');
    }

    return mockResponse([
      { area: 'Mirpur', riskScore: 0.85, trend: 'increasing' },
      { area: 'Dhanmondi', riskScore: 0.72, trend: 'stable' },
      { area: 'Gulshan', riskScore: 0.45, trend: 'decreasing' },
    ]);
  },
};

// Notification API
export const notificationAPI = {
  getNotifications: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/notifications');
    }

    const notifications = [
      {
        id: '1',
        title: 'New Crime Nearby',
        message: 'Theft reported 500m from your location',
        type: 'crime',
        read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'High Risk Zone Alert',
        message: 'You are entering a high-risk area',
        type: 'warning',
        read: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    return mockResponse(notifications);
  },

  markAsRead: async (id: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/notifications/${id}/read`, {
        method: 'PUT',
      });
    }

    return mockResponse({ success: true });
  },

  markAllAsRead: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/notifications/read-all', {
        method: 'PUT',
      });
    }

    return mockResponse({ success: true });
  },
};

// Route API
export const routeAPI = {
  calculateSafeRoute: async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/routes/calculate', {
        method: 'POST',
        body: JSON.stringify({ startLat, startLng, endLat, endLng }),
      });
    }

    // Mock route calculation
    const route = {
      distance: 5.2,
      duration: 15,
      safetyScore: 0.85,
      coordinates: [
        [startLat, startLng],
        [startLat + 0.01, startLng + 0.01],
        [endLat, endLng],
      ],
      warnings: ['High crime area between 8 PM - 2 AM'],
    };

    return mockResponse(route);
  },

  getSavedRoutes: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/routes/saved');
    }

    return mockResponse([]);
  },
};

// Emergency API
export const emergencyAPI = {
  sendSOS: async (latitude: number, longitude: number, emergencyType?: string, message?: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/emergency/sos', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, emergencyType, message }),
      });
    }

    const sos = {
      id: String(Date.now()),
      latitude,
      longitude,
      emergencyType: emergencyType || 'emergency',
      message: message || 'Emergency assistance needed',
      status: 'active',
      user_id: getCurrentUser()?.id,
      created_at: new Date().toISOString(),
    };

    return mockResponse(sos);
  },

  getActiveSOS: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/emergency/sos/active');
    }

    return mockResponse([]);
  },

  updateSOSStatus: async (id: string, status: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/emergency/sos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    }

    return mockResponse({ id, status });
  },
};

// User API
export const userAPI = {
  getUsers: async () => {
    if (!USE_MOCK_API) {
      return fetchWithAuth('/users');
    }

    const users = MOCK_USERS.map(({ password, ...user }) => user);
    return mockResponse(users);
  },

  getUserById: async (id: string) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/users/${id}`);
    }

    const user = MOCK_USERS.find(u => u.id === id);
    if (!user) {
      throw new Error('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return mockResponse(userWithoutPassword);
  },

  updateUser: async (id: string, userData: any) => {
    if (!USE_MOCK_API) {
      return fetchWithAuth(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
    }

    return mockResponse({ ...userData, id });
  },
};

// WebSocket Service (Mock)
export class WebSocketService {
  private listeners: Map<string, Set<Function>> = new Map();
  private connected: boolean = false;
  private messageQueue: Array<{ event: string; data: any }> = [];

  connect() {
    if (this.connected) {
      console.log('✓ WebSocket already connected');
      return;
    }

    this.connected = true;
    console.log('✓ WebSocket connected (mock mode)');
    
    // Process any queued messages
    this.processQueue();
  }

  private processQueue() {
    while (this.messageQueue.length > 0) {
      const { event, data } = this.messageQueue.shift()!;
      this.send(event, data);
    }
  }

  send(event: string, data: any) {
    // If not connected, queue the message
    if (!this.connected) {
      console.warn('WebSocket not connected, queueing message:', event);
      this.messageQueue.push({ event, data });
      return;
    }

    console.log('WebSocket send (mock):', event, data);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  updateLocation(latitude: number, longitude: number, accuracy?: number) {
    this.send('location:update', { latitude, longitude, accuracy });
  }

  sendEmergencySOS(latitude: number, longitude: number, emergencyType?: string, message?: string) {
    this.send('emergency:sos', { latitude, longitude, emergencyType, message });
  }

  disconnect() {
    this.connected = false;
    this.messageQueue = [];
    console.log('WebSocket disconnected (mock mode)');
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const wsService = new WebSocketService();

// Don't auto-connect here - let the app connect when needed
// This prevents the "send was called before connect" error

export default {
  authAPI,
  crimeAPI,
  areaAPI,
  analyticsAPI,
  notificationAPI,
  routeAPI,
  emergencyAPI,
  userAPI,
  wsService,
};