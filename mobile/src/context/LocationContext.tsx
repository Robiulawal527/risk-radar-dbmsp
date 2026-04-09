// Location Context - Background Location Tracking
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { wsService } from '../services/api';

interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp?: number;
}

interface LocationContextType {
  currentLocation: Location | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<Location>;
  permissionGranted: boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    // Request location permission on mount
    requestLocationPermission();

    return () => {
      // Cleanup on unmount
      stopTracking();
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Risk Radar needs access to your location to track crimes nearby.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionGranted(true);
          
          // Request background location (Android 10+)
          const platformVersion = Number(Platform.Version);
        if (platformVersion >= 29) {
            const bgGranted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              {
                title: 'Background Location Permission',
                message: 'Allow Risk Radar to track your location in the background for safety alerts.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
          }
        }
      } else {
        // iOS - permission handled by Info.plist
        setPermissionGranted(true);
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            timestamp: Number(position.timestamp),
          };
          
          setCurrentLocation(location);
          resolve(location);
        },
        (error) => {
          console.error('Get location error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  };

  const startTracking = async () => {
    try {
      if (!permissionGranted) {
        await requestLocationPermission();
      }

      // Configure background geolocation
      await BackgroundGeolocation.ready({
        // Geolocation Config
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 50, // meters
        stopTimeout: 5,
        
        // Activity Recognition
        stopDetectionDelay: 1,
        
        // Application config
        debug: __DEV__, // Enable console logs in development
        logLevel: __DEV__ ? BackgroundGeolocation.LOG_LEVEL_VERBOSE : BackgroundGeolocation.LOG_LEVEL_OFF,
        stopOnTerminate: false,
        startOnBoot: true,
        
        // HTTP / SQLite config
        url: '', // We'll send via WebSocket instead
        batchSync: false,
        autoSync: false,
        
        // Android specific
        foregroundService: true,
        notification: {
          title: 'Risk Radar Active',
          text: 'Monitoring your location for safety',
          color: '#dc2626',
          smallIcon: 'ic_notification',
          largeIcon: 'ic_launcher',
        },
        
        // iOS specific
        preventSuspend: true,
        heartbeatInterval: 60,
      });

      // Set up location listener
      BackgroundGeolocation.onLocation(
        (location) => {
          console.log('[location] -', location);
          
          const loc: Location = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
            speed: location.coords.speed,
            heading: location.coords.heading,
            timestamp: Number(location.timestamp),
          };

          setCurrentLocation(loc);

          // Send location to server via WebSocket
          wsService.updateLocation(
            loc.latitude,
            loc.longitude,
            loc.accuracy
          );
        },
        (error) => {
          console.error('[location] ERROR -', error);
        }
      );

      // Set up motion change listener
      BackgroundGeolocation.onMotionChange((event) => {
        console.log('[motionchange] -', event.isMoving, event.location);
      });

      // Set up geofence listener
      BackgroundGeolocation.onGeofence((event) => {
        console.log('[geofence] -', event);
        // Could trigger alerts when entering high-risk zones
      });

      // Start tracking
      await BackgroundGeolocation.start();
      setIsTracking(true);
      
      // Get initial location
      await getCurrentLocation();

    } catch (error) {
      console.error('Start tracking error:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const stopTracking = () => {
    BackgroundGeolocation.stop();
    BackgroundGeolocation.removeListeners();
    setIsTracking(false);
  };

  const value: LocationContextType = {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    getCurrentLocation,
    permissionGranted,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
