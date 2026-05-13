import axios from 'axios';
import { env } from './env';
import { useAuthStore } from '@/store/auth';

export const api = axios.create({
  baseURL: env.apiUrl.replace(/\/$/, ''),
  timeout: env.apiTimeout,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
