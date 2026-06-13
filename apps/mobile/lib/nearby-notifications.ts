import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { CrimeType, NotificationType, Severity, SOSStatus, type User } from '@risk-radar/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { api } from './api';

const SEEN_KEY = 'risk-radar:seen-nearby-notifications';
const NOTIFICATION_CHANNEL_ID = 'nearby-alerts';
const DEFAULT_RADIUS_KM = Number(process.env.EXPO_PUBLIC_NEARBY_ALERT_RADIUS_KM ?? '10') || 10;
const MAX_REALTIME_RETRIES = 5;
const envCrime = (process.env.EXPO_PUBLIC_SUPABASE_CRIME_TABLE || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);
const CRIME_TABLES: readonly string[] = Array.from(new Set([...envCrime, 'crimes', 'Crime', 'crime', 'incidents']));
const SOS_TABLES = ['sos_alerts', 'SOSRequest', 'sos_requests', 'sos'] as const;

type RealtimeRow = Record<string, unknown>;
type BackendNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read?: boolean;
  data?: Record<string, unknown>;
};

let notificationHandlerConfigured = false;
let notificationsModule: typeof Notifications | null = null;
let notificationsLoadAttempted = false;

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

function logNotificationWarning(message: string, error?: unknown) {
  const details = error ? ` ${getErrorMessage(error)}` : '';
  console.warn(`[Risk Radar] ${message}.${details}`);
}

function isRunningInExpoGo(): boolean {
  try {
    // In Expo Go (the client), remote push is disabled for SDK >=53; local notifications still possible
    // but the package auto-runs push token registration side-effects that hard-error in Go.
    // We skip loading the module entirely in Go so the ERROR never appears. Nearby alerts still
    // work via Supabase realtime. Full local+push notifications work in dev-client / standalone builds.
    const c = Constants as any;
    return Constants.appOwnership === 'expo' ||
      c.executionEnvironment === 'storeClient' ||
      !!c.expoGo ||
      !!c.__expo;
  } catch {
    return false;
  }
}

async function getNotifications(): Promise<typeof Notifications | null> {
  if (notificationsLoadAttempted) return notificationsModule;
  notificationsLoadAttempted = true;

  if (Platform.OS === 'web' || isRunningInExpoGo()) {
    notificationsModule = null;
    return null;
  }

  try {
    const mod = await import('expo-notifications');
    notificationsModule = mod as typeof Notifications;
    return notificationsModule;
  } catch (error) {
    logNotificationWarning('expo-notifications not fully available (use a development build for push notifications support in Expo Go)', error);
    notificationsModule = null;
    return null;
  }
}

async function configureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  const N = await getNotifications();
  if (!N) {
    notificationHandlerConfigured = true;
    return;
  }
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  } catch (error) {
    logNotificationWarning('Local notifications are not available in this runtime', error);
  }
}

function getString(row: RealtimeRow, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

function getNumber(row: RealtimeRow, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const earthKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.asin(Math.sqrt(h));
}

function userAlertPoint(user: User | null) {
  if (!user || user.alertsEnabled === false) return null;
  if (typeof user.alertLatitude !== 'number' || typeof user.alertLongitude !== 'number')
    return null;
  if (!Number.isFinite(user.alertLatitude) || !Number.isFinite(user.alertLongitude)) return null;
  return { latitude: user.alertLatitude, longitude: user.alertLongitude };
}

async function seen(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    let ids: string[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        ids = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      } catch {
        await AsyncStorage.removeItem(SEEN_KEY).catch(() => {});
      }
    }

    if (ids.includes(id)) return true;
    const next = [id, ...ids].slice(0, 200);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch (error) {
    logNotificationWarning('Could not update notification history', error);
  }
  return false;
}

async function scheduleNearbyNotification(
  request: Parameters<typeof Notifications.scheduleNotificationAsync>[0]
) {
  try {
    await configureNotificationHandler();
    const N = await getNotifications();
    if (!N) return false;
    await N.scheduleNotificationAsync(request);
    return true;
  } catch (error) {
    logNotificationWarning('Could not schedule local notification', error);
    return false;
  }
}

async function notifyFromBackendRow(row: BackendNotification) {
  if (
    ![NotificationType.CRIME_ALERT, NotificationType.SOS_UPDATE].includes(
      row.type as NotificationType
    )
  )
    return;
  if (await seen(`server:${row.id}`)) return;
  const allowed = await requestNearbyNotificationPermission();
  if (!allowed) return;

  const isSos = row.type === NotificationType.SOS_UPDATE;
  await scheduleNearbyNotification({
    content: {
      title: row.title || (isSos ? 'Live SOS near you' : 'New crime reported nearby'),
      body:
        row.message ||
        (isSos ? 'Open the Radar map for live location.' : 'Open the Radar map for details.'),
      sound: 'default',
      priority: (isSos ? 'max' : 'high') as Notifications.AndroidNotificationPriority,
      data: {
        ...(row.data ?? {}),
        type: row.type,
        id: row.id,
        source: 'server',
      },
    },
    trigger: null,
  });
}

export async function pollBackendNearbyNotifications() {
  try {
    const response = await api.get<{ success: boolean; data?: BackendNotification[] }>(
      '/notifications'
    );
    const rows = response.data.data ?? [];
    await Promise.all(
      rows
        .filter((row) => !row.read)
        .slice(0, 12)
        .map(notifyFromBackendRow)
    );
  } catch (error) {
    const msg = getErrorMessage(error).toLowerCase();
    const status = (error as any)?.response?.status;
    const isNetworkIssue = !((error as any)?.response) && /(network|net::|conn|timeout|aborted|fetch|ECONN)/.test(msg);
    const isMissingOrClientError = !!status && status >= 400 && status < 500; // 404 (no /notifications on that server), 401 etc. are common when backend not the real one or not running
    if (isNetworkIssue || isMissingOrClientError) {
      // Throttle noisy warnings (common when only expo is started, API_URL points at web dev server, or no backend)
      const now = Date.now();
      if (!((globalThis as any).__riskLastPollWarn) || now - (globalThis as any).__riskLastPollWarn > 120000) {
        console.log('[Risk Radar] Server notifications poll unavailable (backend may be offline or the API base does not serve /notifications). Realtime via Supabase still works for nearby alerts.');
        (globalThis as any).__riskLastPollWarn = now;
      }
    } else {
      logNotificationWarning('Could not poll server notifications', error);
    }
  }
}

export async function requestNearbyNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    await configureNotificationHandler();
    const N = await getNotifications();
    if (!N) return false;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Nearby safety alerts',
        importance: 7 as Notifications.AndroidImportance,
        vibrationPattern: [0, 250, 120, 250],
        lightColor: '#FF2E63',
        sound: 'default',
      });
    }

    const current = await N.getPermissionsAsync();
    if (
      current.granted ||
      current.ios?.status === N.IosAuthorizationStatus?.PROVISIONAL
    ) {
      return true;
    }
    const requested = await N.requestPermissionsAsync();
    return (
      requested.granted ||
      requested.ios?.status === N.IosAuthorizationStatus?.PROVISIONAL
    );
  } catch (error) {
    logNotificationWarning('Could not request notification permission', error);
    return false;
  }
}

export async function notifyNearbyCrime(
  row: RealtimeRow,
  user: User | null,
  radiusKm = DEFAULT_RADIUS_KM
) {
  try {
    const alertPoint = userAlertPoint(user);
    const latitude = getNumber(row, 'latitude', 'lat');
    const longitude = getNumber(row, 'longitude', 'lng', 'lon');
    const reporterId = getString(row, 'user_id', 'userId', 'reporter_id');
    const id =
      getString(row, 'id') ??
      `${latitude}:${longitude}:${getString(row, 'created_at', 'createdAt')}`;
    if (!alertPoint || latitude === undefined || longitude === undefined || reporterId === user?.id)
      return;

    const distance = distanceKm(alertPoint, { latitude, longitude });
    if (distance > radiusKm || (await seen(`crime:${id}`))) return;
    const allowed = await requestNearbyNotificationPermission();
    if (!allowed) return;

    const title = getString(row, 'title') ?? 'New nearby incident';
    const area = getString(row, 'area', 'district', 'address') ?? 'near your alert area';
    await scheduleNearbyNotification({
      content: {
        title: 'New crime reported nearby',
        body: `${title} in ${area} (${distance.toFixed(1)} km away).`,
        sound: 'default',
        data: {
          type: NotificationType.CRIME_ALERT,
          id,
          latitude,
          longitude,
          distanceKm: distance,
          crimeType: getString(row, 'type') ?? CrimeType.OTHER,
          severity: getString(row, 'severity') ?? Severity.MEDIUM,
        },
      },
      trigger: null,
    });
  } catch (error) {
    logNotificationWarning('Nearby crime notification failed', error);
  }
}

export async function notifyNearbySos(
  row: RealtimeRow,
  user: User | null,
  radiusKm = DEFAULT_RADIUS_KM
) {
  try {
    const alertPoint = userAlertPoint(user);
    const latitude = getNumber(row, 'latitude', 'lat');
    const longitude = getNumber(row, 'longitude', 'lng', 'lon');
    const senderId = getString(row, 'user_id', 'userId');
    const status = getString(row, 'status')?.toUpperCase() ?? SOSStatus.ACTIVE;
    const id =
      getString(row, 'id') ??
      `${latitude}:${longitude}:${getString(row, 'created_at', 'createdAt')}`;
    if (!alertPoint || latitude === undefined || longitude === undefined || senderId === user?.id)
      return;
    if (status !== SOSStatus.ACTIVE) return;

    const distance = distanceKm(alertPoint, { latitude, longitude });
    if (distance > radiusKm || (await seen(`sos:${id}`))) return;
    const allowed = await requestNearbyNotificationPermission();
    if (!allowed) return;

    await scheduleNearbyNotification({
      content: {
        title: 'Live SOS near you',
        body: `Someone sent an SOS ${distance.toFixed(1)} km away. Tap the Radar map to see the live location.`,
        sound: 'default',
        priority: 'max' as Notifications.AndroidNotificationPriority,
        data: {
          type: NotificationType.SOS_UPDATE,
          id,
          latitude,
          longitude,
          distanceKm: distance,
          status,
          liveLocation: true,
        },
      },
      trigger: null,
    });
  } catch (error) {
    logNotificationWarning('Nearby SOS notification failed', error);
  }
}

export function addNearbyNotificationResponseListener(onResponse: () => void) {
  let removed = false;
  let subscription: { remove: () => void } | null = null;

  void (async () => {
    try {
      await configureNotificationHandler();
      const N = await getNotifications();
      if (!N || removed) return;
      subscription = N.addNotificationResponseReceivedListener(() => {
        if (!removed) onResponse();
      });
    } catch (error) {
      logNotificationWarning('Could not attach notification tap handler', error);
    }
  })();

  return () => {
    removed = true;
    subscription?.remove();
  };
}

export function subscribeToNearbySafetyAlerts(getUser: () => User | null) {
  if (!isSupabaseConfigured()) return () => {};

  let closed = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const cleanupChannel = () => {
    if (!channel) return;
    const previous = channel;
    channel = null;
    void supabase.removeChannel(previous).catch((error) => {
      logNotificationWarning('Could not remove old realtime notification channel', error);
    });
  };

  const connect = () => {
    if (closed) return;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    cleanupChannel();

    let nextChannel = supabase.channel(`mobile-nearby-safety-notifications-${Date.now()}`);
    for (const table of CRIME_TABLES) {
      nextChannel = nextChannel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        (payload) => {
          void notifyNearbyCrime(payload.new as RealtimeRow, getUser());
        }
      );
    }
    for (const table of SOS_TABLES) {
      nextChannel = nextChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => {
          void notifyNearbySos(payload.new as RealtimeRow, getUser());
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, (payload) => {
          void notifyNearbySos(payload.new as RealtimeRow, getUser());
        });
    }

    nextChannel.subscribe((status, error) => {
      if (closed || channel !== nextChannel) return;
      if (status === 'SUBSCRIBED') {
        retryCount = 0;
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (retryCount >= MAX_REALTIME_RETRIES) {
          logNotificationWarning(
            'Realtime notification channel stopped reconnecting',
            error ?? status
          );
          return;
        }

        retryCount += 1;
        const delayMs = Math.min(30000, 1000 * 2 ** (retryCount - 1));
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, delayMs);
      }
    });
    channel = nextChannel;
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    cleanupChannel();
  };
}
