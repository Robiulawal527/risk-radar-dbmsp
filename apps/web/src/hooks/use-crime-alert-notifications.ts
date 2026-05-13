'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
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
  const { isAuthenticated, accessToken } = useAuthStore();
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

  const unread = (q.data ?? []).filter((n) => !n.read).length;
  return { unread, refetch: q.refetch };
}
