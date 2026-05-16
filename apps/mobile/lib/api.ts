import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { env } from './env';
import { useAuthStore } from '@/store/auth';

export const api = axios.create({
  baseURL: env.apiUrl.replace(/\/$/, ''),
  timeout: env.apiTimeout,
});

function hasAuthorizationHeader(config: InternalAxiosRequestConfig): boolean {
  const h = config.headers;
  if (!h) return false;
  if (h instanceof AxiosHeaders) {
    return Boolean(h.get('Authorization') ?? h.get('authorization'));
  }
  const r = h as Record<string, string | string[] | undefined>;
  return Boolean(r.Authorization ?? r.authorization);
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !hasAuthorizationHeader(config)) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    } else if (!(config.headers instanceof AxiosHeaders)) {
      config.headers = AxiosHeaders.from(config.headers);
    }
    (config.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);
