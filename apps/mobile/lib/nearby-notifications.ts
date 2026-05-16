import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CrimeType, NotificationType, Severity, SOSStatus, type User } from '@risk-radar/types';
import { supabase, isSupabaseConfigured } from './supabase';

const SEEN_KEY = 'risk-radar:seen-nearby-notifications';
const DEFAULT_RADIUS_KM = Number(process.env.EXPO_PUBLIC_NEARBY_ALERT_RADIUS_KM ?? '10') || 10;

type RealtimeRow = Record<string, unknown>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.asin(Math.sqrt(h));
}

function userAlertPoint(user: User | null) {
  if (!user || user.alertsEnabled === false) return null;
  if (typeof user.alertLatitude !== 'number' || typeof user.alertLongitude !== 'number') return null;
  if (!Number.isFinite(user.alertLatitude) || !Number.isFinite(user.alertLongitude)) return null;
  return { latitude: user.alertLatitude, longitude: user.alertLongitude };
}

async function seen(id: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SEEN_KEY);
  const ids = raw ? (JSON.parse(raw) as string[]) : [];
  if (ids.includes(id)) return true;
  const next = [id, ...ids].slice(0, 200);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
  return false;
}

export async function requestNearbyNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nearby-alerts', {
      name: 'Nearby safety alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 120, 250],
      lightColor: '#FF2E63',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function notifyNearbyCrime(row: RealtimeRow, user: User | null, radiusKm = DEFAULT_RADIUS_KM) {
  const alertPoint = userAlertPoint(user);
  const latitude = getNumber(row, 'latitude', 'lat');
  const longitude = getNumber(row, 'longitude', 'lng', 'lon');
  const reporterId = getString(row, 'user_id', 'userId', 'reporter_id');
  const id = getString(row, 'id') ?? `${latitude}:${longitude}:${getString(row, 'created_at', 'createdAt')}`;
  if (!alertPoint || latitude === undefined || longitude === undefined || reporterId === user?.id) return;

  const distance = distanceKm(alertPoint, { latitude, longitude });
  if (distance > radiusKm || (await seen(`crime:${id}`))) return;
  const allowed = await requestNearbyNotificationPermission();
  if (!allowed) return;

  const title = getString(row, 'title') ?? 'New nearby incident';
  const area = getString(row, 'area', 'district', 'address') ?? 'near your alert area';
  await Notifications.scheduleNotificationAsync({
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
}

export async function notifyNearbySos(row: RealtimeRow, user: User | null, radiusKm = DEFAULT_RADIUS_KM) {
  const alertPoint = userAlertPoint(user);
  const latitude = getNumber(row, 'latitude', 'lat');
  const longitude = getNumber(row, 'longitude', 'lng', 'lon');
  const senderId = getString(row, 'user_id', 'userId');
  const status = getString(row, 'status')?.toUpperCase() ?? SOSStatus.ACTIVE;
  const id = getString(row, 'id') ?? `${latitude}:${longitude}:${getString(row, 'created_at', 'createdAt')}`;
  if (!alertPoint || latitude === undefined || longitude === undefined || senderId === user?.id) return;
  if (status !== SOSStatus.ACTIVE) return;

  const distance = distanceKm(alertPoint, { latitude, longitude });
  if (distance > radiusKm || (await seen(`sos:${id}`))) return;
  const allowed = await requestNearbyNotificationPermission();
  if (!allowed) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Live SOS near you',
      body: `Someone sent an SOS ${distance.toFixed(1)} km away. Tap the Radar map to see the live location.`,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
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
}

export function subscribeToNearbySafetyAlerts(getUser: () => User | null) {
  if (!isSupabaseConfigured()) return () => {};

  const channel = supabase
    .channel('mobile-nearby-safety-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crimes' }, (payload) => {
      void notifyNearbyCrime(payload.new as RealtimeRow, getUser());
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_alerts' }, (payload) => {
      void notifyNearbySos(payload.new as RealtimeRow, getUser());
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_alerts' }, (payload) => {
      void notifyNearbySos(payload.new as RealtimeRow, getUser());
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
