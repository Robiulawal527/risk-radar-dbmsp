'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth';
import { SOS_ALERT_TABLES } from '@/lib/sos-alerts';

type NotifRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
};

const SEEN_STORAGE_KEY = 'risk-radar:web-nearby-notifications';
const CRIME_TABLES = ['crimes', 'Crime', 'crime', 'incidents'] as const;

function getString(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return undefined;
}

function getNumber(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return undefined;
}

function rememberOnce(key: string) {
  if (typeof window === 'undefined') return true;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
    const ids = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
    if (ids.includes(key)) return false;
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([key, ...ids].slice(0, 300)));
  } catch {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([key]));
  }
  return true;
}

function requestBrowserNotification(title: string, body: string, data?: Record<string, unknown>) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, data });
    return;
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') new Notification(title, { body, data });
    });
  }
}

/**
 * Polls persisted notifications and listens to Supabase realtime rows so signed-in
 * users get nearby crime and SOS alerts while the dashboard is open.
 */
export function useCrimeAlertNotifications() {
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const seen = useRef<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ['notifications'],
    enabled: Boolean(isAuthenticated && accessToken),
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: NotifRow[] }>('/notifications');
      return res.data.data ?? [];
    },
    refetchInterval: 45_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    const list = q.data;
    if (!list) return;

    for (const n of list) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (
        (n.type === 'CRIME_ALERT' || n.type === 'SOS_UPDATE') &&
        !n.read &&
        rememberOnce(`server:${n.id}`)
      ) {
        toast.warning(n.title, { description: n.message, duration: 12_000 });
        requestBrowserNotification(n.title, n.message, n.data);
      }
    }
  }, [q.data]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      typeof user?.alertLatitude !== 'number' ||
      typeof user?.alertLongitude !== 'number' ||
      user.alertsEnabled === false
    )
      return;
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const radiusKm = Number(process.env.NEXT_PUBLIC_NEARBY_ALERT_RADIUS_KM ?? '10') || 10;
    const distanceKm = (lat: number, lng: number) => {
      const earthKm = 6371;
      const dLat = ((lat - user.alertLatitude!) * Math.PI) / 180;
      const dLng = ((lng - user.alertLongitude!) * Math.PI) / 180;
      const lat1 = (user.alertLatitude! * Math.PI) / 180;
      const lat2 = (lat * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return earthKm * 2 * Math.asin(Math.sqrt(h));
    };
    const notify = (key: string, title: string, body: string, data?: Record<string, unknown>) => {
      if (!rememberOnce(key)) return;
      toast.warning(title, { description: body, duration: 12_000 });
      requestBrowserNotification(title, body, data);
    };
    let channel = supabase.channel(`web-nearby-safety-notifications-${Date.now()}`);
    for (const table of CRIME_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (String(row.user_id ?? row.userId ?? row.reporter_id ?? '') === user.id) return;
          const lat = getNumber(row, 'latitude', 'lat');
          const lng = getNumber(row, 'longitude', 'lng', 'lon');
          if (lat === undefined || lng === undefined) return;
          const distance = distanceKm(lat, lng);
          if (distance > radiusKm) return;
          const id =
            getString(row, 'id') ?? `${lat}:${lng}:${getString(row, 'created_at', 'createdAt')}`;
          const title = getString(row, 'title') ?? 'Incident';
          const area = getString(row, 'area', 'district', 'address') ?? 'your alert area';
          notify(
            `crime:${id}`,
            'New crime reported nearby',
            `${title} in ${area} (${distance.toFixed(1)} km away).`,
            {
              type: 'CRIME_ALERT',
              id,
              latitude: lat,
              longitude: lng,
              distanceKm: distance,
            }
          );
        }
      );
    }
    for (const table of SOS_ALERT_TABLES) {
      const onSos = (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as Record<string, unknown>;
        if (String(row.user_id ?? row.userId ?? '') === user.id) return;
        if (String(row.status ?? 'ACTIVE').toUpperCase() !== 'ACTIVE') return;
        const lat = getNumber(row, 'latitude', 'lat');
        const lng = getNumber(row, 'longitude', 'lng', 'lon');
        if (lat === undefined || lng === undefined) return;
        const distance = distanceKm(lat, lng);
        if (distance > radiusKm) return;
        const id =
          getString(row, 'id') ?? `${lat}:${lng}:${getString(row, 'created_at', 'createdAt')}`;
        notify(
          `sos:${id}`,
          'Live SOS near you',
          `Someone sent an SOS ${distance.toFixed(1)} km away. Open the map for live location.`,
          { type: 'SOS_UPDATE', id, latitude: lat, longitude: lng, distanceKm: distance }
        );
      };
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, onSos)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table }, onSos);
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user]);

  const unread = (q.data ?? []).filter((n) => !n.read).length;
  return { unread, refetch: q.refetch };
}
