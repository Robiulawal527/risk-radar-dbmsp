// Risk Radar Mobile App - Main Entry Point
import React, { useEffect } from 'react';
import { StatusBar, LogBox, Platform, PermissionsAndroid } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { LocationProvider } from './context/LocationContext';
import { NotificationProvider } from './context/NotificationContext';
import AppNavigator from './navigation/AppNavigator';
import { theme } from './theme';
import { setupNotifications } from './services/NotificationService';
import { requestLocationPermission } from './utils/permissions';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'AsyncStorage has been extracted from react-native',
]);

const App = () => {
  useEffect(() => {
    // Initialize app
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Request permissions
      await requestLocationPermission();
      
      // Setup notifications
      await setupNotifications();

      // Request notification permissions (iOS)
      const platformVersion = Number(Platform.Version);
      if (Platform.OS === 'ios') {
        // iOS notification permissions handled by Firebase
      } else if (platformVersion >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }
    } catch (error) {
      console.error('App initialization error:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <LanguageProvider>
              <LocationProvider>
                <NotificationProvider>
                  <NavigationContainer>
                    <StatusBar
                      barStyle="light-content"
                      backgroundColor="#dc2626"
                    />
                    <AppNavigator />
                  </NavigationContainer>
                </NotificationProvider>
              </LocationProvider>
            </LanguageProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
