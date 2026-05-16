import { useEffect } from 'react';
import { router } from 'expo-router';
import { addNearbyNotificationResponseListener, subscribeToNearbySafetyAlerts } from '@/lib/nearby-notifications';
import { useAuthStore } from '@/store/auth';

export function NearbySafetyNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToNearbySafetyAlerts(() => useAuthStore.getState().user);
  }, [isAuthenticated]);

  useEffect(() => {
    return addNearbyNotificationResponseListener(() => {
      router.push('/(tabs)/map' as never);
    });
  }, []);

  return null;
}
