// Home Screen - Main Map View
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { FAB, Portal, Text, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { crimeAPI, emergencyAPI, wsService } from '../services/api';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

interface Crime {
  id: string;
  latitude: number;
  longitude: number;
  crime_type_id: string;
  type_name: string;
  severity: number;
  incident_date: string;
  title: string;
  color: string;
}

const HomeScreen = ({ navigation }: any) => {
  const { currentLocation, startTracking, isTracking, getCurrentLocation } = useLocation();
  const { user } = useAuth();
  
  const mapRef = useRef<MapView>(null);
  
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    initializeMap();
    setupRealtimeListeners();
    
    // Start location tracking
    if (!isTracking) {
      startTracking();
    }

    return () => {
      // Cleanup
    };
  }, []);

  const initializeMap = async () => {
    try {
      // Get current location
      const location = await getCurrentLocation();

      // Fetch nearby crimes
      const response = await crimeAPI.getCrimesNearby(
        location.latitude,
        location.longitude,
        10 // 10km radius
      );

      if (response.success) {
        setCrimes(response.data);
      }

      // Center map on user location
      if (mapRef.current && location) {
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      console.error('Initialize map error:', error);
      Alert.alert('Error', 'Failed to load crime data');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListeners = () => {
    // Listen for risk alerts
    wsService.on('risk:alert', (data: any) => {
      Alert.alert(
        '⚠️ High Risk Zone',
        `You are entering ${data.areas[0]?.area_name}. Stay alert!`,
        [{ text: 'OK' }]
      );
    });

    // Listen for nearby crimes
    wsService.on('crime:nearby', (data: any) => {
      if (data.count > 0) {
        Alert.alert(
          '🚨 Crimes Nearby',
          `${data.count} crimes reported within 2km`,
          [
            { text: 'View', onPress: () => navigation.navigate('Crimes') },
            { text: 'OK' },
          ]
        );
      }
    });

    // Listen for new crimes
    wsService.on('crime:new', (crime: Crime) => {
      setCrimes(prev => [crime, ...prev]);
    });
  };

  const handleSOSPress = async () => {
    try {
      if (!currentLocation) {
        Alert.alert('Error', 'Unable to get your location');
        return;
      }

      Alert.alert(
        '🆘 Emergency SOS',
        'Send emergency alert to police?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Send SOS',
            style: 'destructive',
            onPress: async () => {
              try {
                await emergencyAPI.sendSOS(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  'emergency',
                  'Emergency assistance needed'
                );

                Alert.alert('Success', 'SOS sent to police!');
              } catch (error) {
                Alert.alert('Error', 'Failed to send SOS');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('SOS error:', error);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    initializeMap();
  };

  const getMarkerColor = (severity: number) => {
    if (severity >= 4) return '#dc2626'; // red
    if (severity >= 3) return '#f59e0b'; // amber
    return '#10b981'; // green
  };

  const filteredCrimes = crimes.filter(crime => {
    if (selectedFilter === 'all') return true;
    return crime.crime_type_id === selectedFilter;
  });

  if (loading && crimes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading crime data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || 23.8103,
          longitude: currentLocation?.longitude || 90.4125,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
        followsUserLocation
      >
        {/* Crime Markers */}
        {filteredCrimes.map((crime) => (
          <Marker
            key={crime.id}
            coordinate={{
              latitude: crime.latitude,
              longitude: crime.longitude,
            }}
            pinColor={getMarkerColor(crime.severity)}
            onPress={() => navigation.navigate('CrimeDetail', { crimeId: crime.id })}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{crime.type_name}</Text>
                <Text style={styles.calloutDescription}>{crime.title}</Text>
                <Text style={styles.calloutDate}>
                  {new Date(crime.incident_date).toLocaleDateString()}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Chip
          selected={selectedFilter === 'all'}
          onPress={() => setSelectedFilter('all')}
          style={styles.chip}
        >
          All
        </Chip>
        <Chip
          selected={selectedFilter === 'theft'}
          onPress={() => setSelectedFilter('theft')}
          style={styles.chip}
        >
          Theft
        </Chip>
        <Chip
          selected={selectedFilter === 'robbery'}
          onPress={() => setSelectedFilter('robbery')}
          style={styles.chip}
        >
          Robbery
        </Chip>
      </View>

      {/* Stats Badge */}
      <View style={styles.statsBadge}>
        <Text style={styles.statsText}>
          {filteredCrimes.length} crimes nearby
        </Text>
      </View>

      {/* Floating Action Buttons */}
      <Portal>
        <FAB.Group
          open={fabOpen}
          visible
          icon={fabOpen ? 'close' : 'menu'}
          actions={[
            {
              icon: 'alert',
              label: 'Emergency SOS',
              onPress: handleSOSPress,
              color: colors.error,
              style: { backgroundColor: '#fee2e2' },
            },
            {
              icon: 'refresh',
              label: 'Refresh',
              onPress: handleRefresh,
            },
            {
              icon: 'navigation',
              label: 'Safe Route',
              onPress: () => navigation.navigate('SafeRoute'),
            },
            {
              icon: 'plus',
              label: 'Report Crime',
              onPress: () => navigation.navigate('Report'),
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          fabStyle={styles.fab}
        />
      </Portal>

      {/* Location Tracking Indicator */}
      {isTracking && (
        <View style={styles.trackingIndicator}>
          <Icon name="map-marker-check" size={16} color="#10b981" />
          <Text style={styles.trackingText}>Location Tracking Active</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  map: {
    width,
    height,
  },
  filtersContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
  },
  statsBadge: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  callout: {
    padding: 8,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  fab: {
    backgroundColor: colors.primary,
  },
  trackingIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 2,
  },
  trackingText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
});

export default HomeScreen;
