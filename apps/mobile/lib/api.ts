import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { env } from './env';
import { useAuthStore } from '@/store/auth';
import { supabase } from './supabase';

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

/**
 * Always prefer a live token from the Supabase client (it manages refresh automatically).
 * This keeps the stored token (used by supabaseWithAccessToken in admin-data, rankings, etc.)
 * and the one we send to the custom backend in sync.
 */
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = useAuthStore.getState().accessToken;

  try {
    // This is cheap when a session is cached. It will trigger an internal refresh if the JWT is near expiry.
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      token = data.session.access_token;

      // Keep the zustand store fresh so that other code paths (admin data fetchers, etc.)
      // and future requests see the current token without another getSession.
      const current = useAuthStore.getState();
      if (current.accessToken !== token && current.user) {
        useAuthStore.getState().patchTokens(token, data.session.refresh_token ?? undefined);
      }
    }
  } catch {
    // Fall back to whatever we have in the store (may be stale but better than nothing for this request)
  }

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
  async (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      // Attempt a refresh via Supabase before giving up.
      try {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData.session?.access_token) {
          const current = useAuthStore.getState();
          if (current.user) {
            useAuthStore.getState().patchTokens(
              refreshData.session.access_token,
              refreshData.session.refresh_token ?? undefined
            );
          }
          // Do not logout here — let the caller retry the original operation (or the next request will have fresh token).
          // Re-throw so the original call site still sees the error for this attempt.
        } else {
          // Refresh failed → session is truly dead.
          await useAuthStore.getState().clearAuth();
        }
      } catch {
        await useAuthStore.getState().clearAuth();
      }
    }

    return Promise.reject(err);
  }
);
