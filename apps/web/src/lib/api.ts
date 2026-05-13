import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

/**
 * Browser: same-origin `/api/backend/*` → App route proxies to Express (or Supabase fallback for auth/me).
 * Server (rare): direct URL for SSR.
 */
function serverSideApiBaseUrl(): string {
  const local = process.env.NEXT_PUBLIC_API_URL_LOCAL?.trim();
  const deployed = process.env.NEXT_PUBLIC_API_URL?.trim();
  const fallback = 'http://127.0.0.1:3001/api';
  if (process.env.NODE_ENV === 'development') {
    return local || fallback;
  }
  return deployed || local || fallback;
}

function hasAuthorizationHeader(config: InternalAxiosRequestConfig): boolean {
  const h = config.headers;
  if (!h) return false;
  if (h instanceof AxiosHeaders) {
    return Boolean(h.get('Authorization') ?? h.get('authorization'));
  }
  const r = h as Record<string, string | string[] | undefined>;
  return Boolean(r.Authorization ?? r.authorization);
}

export const api = axios.create({
  timeout: 20_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    config.baseURL = '/api/backend';
  } else {
    config.baseURL = serverSideApiBaseUrl();
  }

  // Login/signup pass a fresh Supabase JWT; do not overwrite with a persisted (often expired) token.
  if (!hasAuthorizationHeader(config)) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      } else if (!(config.headers instanceof AxiosHeaders)) {
        config.headers = AxiosHeaders.from(config.headers);
      }
      (config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      useAuthStore.getState().logout();
      if (!window.location.pathname.startsWith('/auth/')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(err);
  }
);
