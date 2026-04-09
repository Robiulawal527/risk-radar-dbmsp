// API Service for Backend Integration
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import io from 'socket.io-client';

const API_URL = Config.API_URL || 'http://localhost:5000/api/v1';
const WS_URL = Config.WS_URL || 'ws://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, logout
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // Navigate to login would be handled by navigation service
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// Authentication API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.success && response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  },

  register: async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    if (response.success && response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  },

  getMe: () => api.get('/auth/me'),

  updateProfile: (data: any) => api.put('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),
};

// Crime API
export const crimeAPI = {
  getCrimes: (params?: any) => api.get('/crimes', { params }),
  
  getCrimeById: (id: string) => api.get(`/crimes/${id}`),
  
  createCrime: (data: any) => api.post('/crimes', data),
  
  updateCrime: (id: string, data: any) => api.put(`/crimes/${id}`, data),
  
  deleteCrime: (id: string) => api.delete(`/crimes/${id}`),
  
  getCrimeTypes: () => api.get('/crimes/types'),
  
  getCrimesNearby: (lat: number, lng: number, radius: number = 5) =>
    api.get('/crimes/nearby', { params: { lat, lng, radius } }),
};

// Area API
export const areaAPI = {
  getAreas: () => api.get('/areas'),
  getAreaById: (id: string) => api.get(`/areas/${id}`),
  getHighRiskAreas: () => api.get('/areas/risk/high'),
};

// Analytics API
export const analyticsAPI = {
  getStats: () => api.get('/analytics/stats'),
  getAreaStats: () => api.get('/analytics/areas'),
  getPredictions: () => api.get('/analytics/predictions'),
};

// Notification API
export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

// Route API
export const routeAPI = {
  calculateSafeRoute: (startLat: number, startLng: number, endLat: number, endLng: number) =>
    api.post('/routes/calculate', { startLat, startLng, endLat, endLng }),
  
  getSavedRoutes: () => api.get('/routes/saved'),
};

// Emergency API
export const emergencyAPI = {
  sendSOS: (latitude: number, longitude: number, emergencyType?: string, message?: string) =>
    api.post('/emergency/sos', { latitude, longitude, emergencyType, message }),
  
  getActiveSOS: () => api.get('/emergency/sos/active'),
  
  updateSOSStatus: (id: string, status: string) =>
    api.put(`/emergency/sos/${id}`, { status }),
};

// Upload API (for images)
export const uploadAPI = {
  uploadImage: async (uri: string, fieldName: string = 'image') => {
    const formData = new FormData();
    formData.append(fieldName, {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);

    const token = await AsyncStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    return response.json();
  },
};

// WebSocket Service
class WebSocketService {
  private socket: any = null;
  private listeners: Map<string, Set<Function>> = new Map();

  async connect() {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✓ WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('WebSocket connection error:', error);
    });

    // Handle incoming messages
    this.socket.onAny((event: string, data: any) => {
      this.emit(event, data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
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

  send(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  // Convenience methods
  updateLocation(latitude: number, longitude: number, accuracy?: number) {
    this.send('location:update', { latitude, longitude, accuracy });
  }

  sendEmergencySOS(latitude: number, longitude: number, emergencyType?: string, message?: string) {
    this.send('emergency:sos', { latitude, longitude, emergencyType, message });
  }

  reportCrime(crimeData: any) {
    this.send('crime:report', crimeData);
  }
}

export const wsService = new WebSocketService();

export default {
  authAPI,
  crimeAPI,
  areaAPI,
  analyticsAPI,
  notificationAPI,
  routeAPI,
  emergencyAPI,
  uploadAPI,
  wsService,
};
