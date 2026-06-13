import { SupabaseAuthSync } from '@/components/SupabaseAuthSync';
import { NearbySafetyNotifications } from '@/components/NearbySafetyNotifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1 },
        },
      })
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <QueryClientProvider client={queryClient}>
        <SupabaseAuthSync />
        <NearbySafetyNotifications />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
