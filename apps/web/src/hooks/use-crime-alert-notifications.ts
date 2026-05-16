'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth';

type NotifRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
};

/**
 * Polls server notifications and surfaces new CRIME_ALERT items as toasts
 * (nearby incident flow is backed by server-side inserts on new crimes).
 */
export function useCrimeAlertNotifications() {
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

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

    if (!primed.current) {
      list.forEach((n) => seen.current.add(n.id));
      primed.current = true;
      return;
    }

    for (const n of list) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.type === 'CRIME_ALERT' && !n.read) {
        toast.warning(n.title, { description: n.message, duration: 12_000 });
      }
    }
  }, [q.data]);

  useEffect(() => {
    if (!isAuthenticated || !user?.alertLatitude || !user?.alertLongitude || user.alertsEnabled === false) return;
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
    const notify = (title: string, body: string) => {
      toast.warning(title, { description: body, duration: 12_000 });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    };
    const channel = supabase
      .channel('web-nearby-safety-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crimes' }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (String(row.user_id ?? row.userId ?? '') === user.id) return;
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const distance = distanceKm(lat, lng);
        if (distance > radiusKm) return;
        notify('New crime reported nearby', `${String(row.title ?? 'Incident')} (${distance.toFixed(1)} km away).`);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_alerts' }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (String(row.user_id ?? row.userId ?? '') === user.id) return;
        if (String(row.status ?? 'ACTIVE').toUpperCase() !== 'ACTIVE') return;
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const distance = distanceKm(lat, lng);
        if (distance > radiusKm) return;
        notify('Live SOS near you', `Someone sent an SOS ${distance.toFixed(1)} km away. Open the map for live location.`);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user]);

  const unread = (q.data ?? []).filter((n) => !n.read).length;
  return { unread, refetch: q.refetch };
}
