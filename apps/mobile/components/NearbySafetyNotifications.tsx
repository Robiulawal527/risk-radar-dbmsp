import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { subscribeToNearbySafetyAlerts } from '@/lib/nearby-notifications';
import { useAuthStore } from '@/store/auth';

export function NearbySafetyNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToNearbySafetyAlerts(() => useAuthStore.getState().user);
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/map' as never);
    });
    return () => subscription.remove();
  }, []);

  return null;
}
