// Environment configuration helper
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:5000',
  appName: import.meta.env.VITE_APP_NAME || 'Risk Radar',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.VITE_APP_ENV || 'development',
  
  // Map settings
  map: {
    defaultLat: parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT) || 23.8103,
    defaultLng: parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG) || 90.4125,
    defaultZoom: parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM) || 12,
  },
  
  // Feature flags
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    notifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true',
    websocket: import.meta.env.VITE_ENABLE_WEBSOCKET === 'true',
  },
  
  // Helper methods
  isDevelopment: () => import.meta.env.DEV,
  isProduction: () => import.meta.env.PROD,
};

export default config;
