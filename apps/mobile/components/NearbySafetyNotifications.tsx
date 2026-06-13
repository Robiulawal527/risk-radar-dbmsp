import { useEffect } from 'react';
import { router } from 'expo-router';
import {
  addNearbyNotificationResponseListener,
  pollBackendNearbyNotifications,
  subscribeToNearbySafetyAlerts,
} from '@/lib/nearby-notifications';
import { useAuthStore } from '@/store/auth';

export function NearbySafetyNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToNearbySafetyAlerts(() => useAuthStore.getState().user);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void pollBackendNearbyNotifications();
    const timer = setInterval(() => {
      void pollBackendNearbyNotifications();
    }, 45_000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    return addNearbyNotificationResponseListener(() => {
      router.push('/(tabs)/map' as never);
    });
  }, [isAuthenticated]);

  return null;
}
