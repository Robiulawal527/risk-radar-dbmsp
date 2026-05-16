'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Loader2, MapPin, RefreshCw, ShieldAlert, Trash2, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { createSosAlertInSupabase, fetchMySosAlertsFromSupabase, resolveSosAlertInSupabase } from '@/lib/sos-alerts';
import { SOSStatus } from '@/lib/types';
import type { SOSRequest } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth';

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type LocalSOSRequest = SOSRequest & {
  isLocalOnly?: boolean;
  syncError?: string;
  updatedAt?: string | Date;
};

const LOCAL_SOS_KEY = 'risk-radar:pending-sos-requests';

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 5_000,
};

const CREATE_SOS_ENDPOINTS = ['/sos', '/sos/'] as const;
const GET_MY_SOS_ENDPOINTS = ['/sos/user', '/sos/my', '/sos/me'] as const;

/** Checks browser availability before touching window, navigator, or localStorage in a client component. */
function isBrowser() {
  return typeof window !== 'undefined';
}

/** Converts API, Supabase, and browser errors into messages people can act on. */
function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeAxiosError = error as {
      response?: { status?: number; data?: { message?: string; error?: string } };
      message?: string;
    };
    const status = maybeAxiosError.response?.status;
    const apiMessage =
      maybeAxiosError.response?.data?.message || maybeAxiosError.response?.data?.error;

    if (status === 503) {
      return 'SOS server is temporarily unavailable. Your request was saved locally and will be shown as pending.';
    }

    if (status) {
      if (
        typeof apiMessage === 'string' &&
        (/schema cache/i.test(apiMessage) || /could not find the table/i.test(apiMessage))
      ) {
        return 'SOS storage is not configured yet. Your request was saved locally.';
      }
      return apiMessage || `Request failed with status code ${status}`;
    }
  }

  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Shortens stored sync errors so pending local SOS cards stay readable. */
function formatSyncError(message?: string) {
  if (!message) return 'server unavailable';
  if (/schema cache/i.test(message) || /could not find the table/i.test(message)) {
    return 'SOS storage is not configured yet';
  }
  return message;
}

/** Opens the local phone dialer for Bangladesh emergency services when the browser supports tel links. */
function callEmergencyServices() {
  if (!isBrowser()) return;
  const link = document.createElement('a');
  link.href = 'tel:999';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Explains browser geolocation failures with permission/GPS-specific guidance. */
function getGeolocationErrorMessage(error: unknown) {
  if (!isBrowser() || !('geolocation' in navigator)) {
    return 'Location is not supported on this browser/device.';
  }

  if (
    typeof GeolocationPositionError !== 'undefined' &&
    error instanceof GeolocationPositionError
  ) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission was denied. Allow location access in your browser and try again.';
      case error.POSITION_UNAVAILABLE:
        return 'Your location is unavailable. Turn on GPS/network location and try again.';
      case error.TIMEOUT:
        return 'Location request timed out. Move to an open area and try again.';
      default:
        return error.message || 'Could not read your location.';
    }
  }

  return getErrorMessage(error);
}

/** Reads one high-accuracy browser GPS fix for SOS creation. */
function getCurrentCoordinates() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!isBrowser() || !('geolocation' in navigator)) {
      reject(new Error('Location is not supported on this browser/device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      reject,
      GEOLOCATION_OPTIONS
    );
  });
}

/** Formats coordinates consistently for remote payloads and local pending SOS records. */
function formatCoordinates({ latitude, longitude }: Coordinates) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Formats SOS timestamps for recent activity cards. */
function formatDateTime(value?: string | Date | null) {
  if (!value) return 'Unknown time';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Chooses the badge variant from status while showing local-only SOS entries as pending. */
function getStatusVariant(status: SOSRequest['status'], isLocalOnly?: boolean) {
  if (isLocalOnly) return 'secondary' as const;
  if (status === SOSStatus.ACTIVE) return 'destructive' as const;
  if (status === SOSStatus.RESOLVED) return 'success' as const;
  return 'secondary' as const;
}

/** Reads locally saved pending SOS rows and safely ignores corrupt localStorage JSON. */
function readLocalSOSRequests(): LocalSOSRequest[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_SOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persists the pending SOS queue used when network or Supabase writes fail. */
function writeLocalSOSRequests(requests: LocalSOSRequest[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(LOCAL_SOS_KEY, JSON.stringify(requests));
}

/** Upserts a pending local SOS without duplicating an existing id. */
function saveLocalSOSRequest(request: LocalSOSRequest) {
  const existing = readLocalSOSRequests();
  const next = [request, ...existing.filter((item) => item.id !== request.id)];
  writeLocalSOSRequests(next);
}

/** Removes a local-only SOS after delete or a successful server sync. */
function removeLocalSOSRequest(id: string) {
  writeLocalSOSRequests(readLocalSOSRequests().filter((item) => item.id !== id));
}

/** Tries compatible backend routes in order so old deployments and the local API both work. */
async function requestWithFallback<T>(
  endpoints: readonly string[],
  request: (endpoint: string) => Promise<T>
) {
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      return await request(endpoint);
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status && ![404, 405, 503].includes(status)) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed.');
}

/** Normalizes list responses from Express, Next proxy, or direct arrays into a SOSRequest array. */
function normalizeRequests(payload: ApiResponse<SOSRequest[]> | SOSRequest[]) {
  if (Array.isArray(payload)) return payload;
  if (payload.success === false) {
    throw new Error(payload.message || payload.error || 'Could not load SOS requests.');
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

/** Normalizes one SOS mutation response regardless of whether the API wraps it in { success, data }. */
function normalizeRequest(payload: ApiResponse<SOSRequest> | SOSRequest) {
  if ('success' in payload && payload.success === false) {
    throw new Error(payload.message || payload.error || 'Could not update SOS request.');
  }
  if ('data' in payload && payload.data) return payload.data;
  return payload as SOSRequest;
}

/** Builds the backend create payload from the current GPS fix. */
function buildSOSPayload(coordinates: Coordinates) {
  return {
    location: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: coordinates.accuracy,
      area: 'GPS fix',
      address: formatCoordinates(coordinates),
    },
    message: 'Emergency assistance requested',
  };
}

/** Creates a local pending SOS when remote creation fails, keeping emergency intent visible. */
function buildLocalRequest(coordinates: Coordinates, syncError: string): LocalSOSRequest {
  const createdAt = new Date().toISOString();

  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `local-${Date.now()}`,
    userId: 'local',
    status: SOSStatus.ACTIVE,
    location: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: coordinates.accuracy,
      area: 'Pending GPS fix',
      address: formatCoordinates(coordinates),
    },
    message: 'Emergency assistance requested',
    createdAt: new Date(createdAt),
    updatedAt: createdAt,
    isLocalOnly: true,
    syncError,
  };
}

export default function SOSPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [confirming, setConfirming] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [localRequests, setLocalRequests] = useState<LocalSOSRequest[]>(() =>
    readLocalSOSRequests()
  );

  /** Reloads pending local SOS rows after create/delete actions mutate localStorage. */
  const refreshLocalRequests = useCallback(() => {
    setLocalRequests(readLocalSOSRequests());
  }, []);

  const {
    data: remoteRequests = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sos-my'],
    queryFn: async () => {
      const data =
        isSupabaseConfigured() && user?.id
          ? await fetchMySosAlertsFromSupabase(user.id).catch(() =>
              requestWithFallback(GET_MY_SOS_ENDPOINTS, async (endpoint) => {
                const res = await api.get<ApiResponse<SOSRequest[]> | SOSRequest[]>(endpoint);
                return normalizeRequests(res.data);
              })
            )
          : await requestWithFallback(GET_MY_SOS_ENDPOINTS, async (endpoint) => {
              const res = await api.get<ApiResponse<SOSRequest[]> | SOSRequest[]>(endpoint);
              return normalizeRequests(res.data);
            });

      return data;
    },
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });

  const requests = useMemo(() => {
    const remoteIds = new Set(remoteRequests.map((request) => request.id));
    const pendingLocal = localRequests.filter((request) => !remoteIds.has(request.id));

    return [...pendingLocal, ...remoteRequests].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [localRequests, remoteRequests]);

  const activeRequest = useMemo(
    () => requests.find((request) => request.status === SOSStatus.ACTIVE),
    [requests]
  );

  /** Resolves synced SOS rows or removes local pending rows, then refreshes every active SOS view. */
  const resolveSOS = useMutation({
    mutationFn: async (request: LocalSOSRequest) => {
      const isLocalOnly = request.isLocalOnly || request.id.startsWith('local-');
      if (isLocalOnly) {
        removeLocalSOSRequest(request.id);
        return { request: { ...request, status: SOSStatus.RESOLVED }, localOnly: true };
      }

      if (!user?.id) throw new Error('Sign in again to update this SOS.');

      let directError: unknown;
      const direct = isSupabaseConfigured()
        ? await resolveSosAlertInSupabase(request.id, user.id).catch((error) => {
            directError = error;
            return null;
          })
        : null;
      if (direct) return { request: direct, localOnly: false };

      const encodedId = encodeURIComponent(request.id);
      let resolved: SOSRequest;
      try {
        resolved = await requestWithFallback(
          [`/sos/${encodedId}/status`, `/sos/${encodedId}`],
          async (endpoint) => {
            const res = endpoint.endsWith('/status')
              ? await api.put<ApiResponse<SOSRequest> | SOSRequest>(endpoint, { status: SOSStatus.RESOLVED })
              : await api.delete<ApiResponse<SOSRequest> | SOSRequest>(endpoint);
            return normalizeRequest(res.data);
          }
        );
      } catch (apiError) {
        throw directError instanceof Error ? directError : apiError;
      }
      return { request: resolved, localOnly: false };
    },
    onMutate: (request) => {
      setResolvingId(request.id);
    },
    onSuccess: async ({ localOnly }) => {
      refreshLocalRequests();
      await queryClient.invalidateQueries({ queryKey: ['sos-my'] });
      await queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] });
      toast.success(localOnly ? 'Pending SOS deleted' : 'SOS resolved', {
        description: 'It will no longer show as a live SOS alert.',
      });
    },
    onError: (err) => {
      toast.error('Could not delete SOS', {
        description: getErrorMessage(err),
      });
    },
    onSettled: () => {
      setResolvingId(null);
    },
  });

  /** Sends an SOS through Supabase first, backend API second, and local pending storage as final fallback. */
  const sendSOS = useMutation({
    mutationFn: async () => {
      const coordinates = await getCurrentCoordinates();
      const payload = buildSOSPayload(coordinates);

      try {
        let directError: unknown;
        const direct =
          user?.id && isSupabaseConfigured()
            ? await createSosAlertInSupabase({
                userId: user.id,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                accuracy: coordinates.accuracy,
                message: 'Emergency assistance requested',
              }).catch((error) => {
                directError = error;
                return null;
              })
            : null;

        let created = direct;
        if (!created) {
          try {
            created = await requestWithFallback(CREATE_SOS_ENDPOINTS, async (endpoint) => {
              const res = await api.post<ApiResponse<SOSRequest> | SOSRequest>(endpoint, payload);
              const body = res.data;

              if ('success' in body && body.success === false) {
                throw new Error(body.message || body.error || 'SOS request could not be created.');
              }

              if ('data' in body && body.data) return body.data;
              return body as SOSRequest;
            });
          } catch (apiError) {
            throw directError instanceof Error ? directError : apiError;
          }
        }

        return { request: created, savedLocally: false };
      } catch (error) {
        const localRequest = buildLocalRequest(coordinates, getErrorMessage(error));
        saveLocalSOSRequest(localRequest);
        return { request: localRequest, savedLocally: true };
      }
    },
    onSuccess: async ({ request, savedLocally }) => {
      setConfirming(false);

      if (savedLocally) {
        const localSyncError =
          'syncError' in request && typeof request.syncError === 'string'
            ? request.syncError
            : 'The server is unavailable. Keep this page open and contact emergency services directly.';
        refreshLocalRequests();
        toast.warning('SOS saved locally', {
          description: localSyncError,
        });
      } else {
        removeLocalSOSRequest(request.id);
        refreshLocalRequests();
        toast.success('SOS sent', {
          description: 'Your emergency request and GPS location were saved.',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['sos-my'] });
      await queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] });
    },
    onError: (err) => {
      toast.error('Could not send SOS', {
        description: getGeolocationErrorMessage(err),
      });
    },
  });

  /** Handles the two-step SOS confirmation so accidental clicks do not create emergency requests. */
  const handlePrimaryAction = () => {
    if (sendSOS.isPending) return;

    if (!confirming) {
      setConfirming(true);
      toast.warning('Confirm emergency SOS', {
        description: 'Press Send now to confirm this is an emergency.',
      });
      return;
    }

    sendSOS.mutate();
    callEmergencyServices();
  };

  /** Confirms and resolves a visible active SOS so it disappears from live maps without deleting history. */
  const handleDeleteSOS = (request: LocalSOSRequest) => {
    if (resolveSOS.isPending) return;
    const isLocalOnly = request.isLocalOnly || request.id.startsWith('local-');
    const confirmed =
      !isBrowser() ||
      window.confirm(
        isLocalOnly
          ? 'Delete this pending local SOS from this browser?'
          : 'Mark this SOS as resolved and remove it from live maps?'
      );
    if (confirmed) resolveSOS.mutate(request);
  };

  /** Refreshes remote SOS history and pending local records together. */
  const handleRefresh = async () => {
    refreshLocalRequests();
    await refetch();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-12">
      <section className="text-center" aria-labelledby="sos-heading">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-red-500/30 bg-red-500/5">
          <AlertCircle className="h-14 w-14 text-red-500" aria-hidden="true" />
        </div>
        <h1
          id="sos-heading"
          className="text-4xl font-black tracking-tighter text-white sm:text-6xl"
        >
          Emergency SOS
        </h1>
        <p className="mt-3 text-base text-slate-400 sm:text-xl">
          Sends your current GPS location and creates an active emergency request.
        </p>
      </section>

      <Card className="glass-panel border-red-500/20 p-6 text-center sm:p-12">
        {activeRequest ? (
          <div className="mx-auto mb-6 flex max-w-xl flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-left text-sm text-red-100 sm:flex-row sm:items-start">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {'isLocalOnly' in activeRequest && activeRequest.isLocalOnly
                  ? 'SOS is pending server sync.'
                  : 'You already have an active SOS request.'}
              </div>
              <div className="mt-1 text-red-100/80">
                Created {formatDateTime(activeRequest.createdAt)}. Avoid duplicate submissions
                unless your location changed or this is a new emergency.
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteSOS(activeRequest as LocalSOSRequest)}
              disabled={resolvingId === activeRequest.id}
              className="shrink-0"
            >
              {resolvingId === activeRequest.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Delete SOS
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handlePrimaryAction}
          disabled={sendSOS.isPending}
          aria-busy={sendSOS.isPending}
          aria-live="polite"
          className="danger-button mx-auto mb-4 h-28 w-28 rounded-full text-xl font-black shadow-[0_0_80px_-10px_rgb(239,68,68)] sm:h-32 sm:w-32 sm:text-2xl"
        >
          {sendSOS.isPending ? (
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          ) : confirming ? (
            'SEND'
          ) : (
            'SOS'
          )}
        </Button>

        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-200">Confirm emergency request</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={sendSOS.isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="mx-auto max-w-md text-sm text-slate-400">
            For life-threatening emergencies, call official emergency services immediately. This
            button records your location in Risk Radar.
          </p>
        )}
      </Card>

      <section aria-labelledby="recent-sos-heading">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div id="recent-sos-heading" className="flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4" aria-hidden="true" /> YOUR RECENT REQUESTS
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isFetching}
              aria-label="Refresh SOS requests"
            >
              <RefreshCw
                className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
                aria-hidden="true"
              />
            </Button>
            <Badge variant="secondary">{isLoading ? '...' : `${requests.length} TOTAL`}</Badge>
          </div>
        </div>

        {isError ? (
          <Card className="glass-card mb-3 flex items-center justify-center gap-2 border-yellow-500/20 p-4 text-center text-sm text-yellow-100">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span>{getErrorMessage(error)} Showing locally saved SOS requests when available.</span>
          </Card>
        ) : null}

        <div className="space-y-3">
          {requests.length > 0 ? (
            requests.map((request, index) => {
              const isLocalOnly = 'isLocalOnly' in request && Boolean(request.isLocalOnly);
              const canDelete = request.status === SOSStatus.ACTIVE || isLocalOnly;

              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <MapPin className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {request.location?.area || 'Location captured'}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {request.location?.address || 'GPS coordinates saved'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(request.createdAt)}
                      </div>
                      {isLocalOnly ? (
                        <div className="mt-1 text-xs text-yellow-200">
                          Pending sync: {formatSyncError((request as LocalSOSRequest).syncError)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={getStatusVariant(request.status, isLocalOnly)}>
                      {isLocalOnly ? 'PENDING' : request.status}
                    </Badge>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSOS(request as LocalSOSRequest)}
                        disabled={resolvingId === request.id}
                      >
                        {resolvingId === request.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                        )}
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <Card className="glass-card py-12 text-center text-slate-400">
              {isLoading
                ? 'Loading emergency requests...'
                : 'No emergency requests yet. Stay safe.'}
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
