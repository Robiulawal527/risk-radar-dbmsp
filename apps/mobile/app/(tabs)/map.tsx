import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import type { Crime } from '@risk-radar/types';
import { api } from '@/lib/api';
import { fetchCrimesForMapFromSupabase, filterCrimesByAreaQuery } from '@/lib/map-crimes';
import { fetchActiveSosAlertsFromSupabase } from '@/lib/sos-alerts';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

function crimesFromApiPayload(payload: unknown): Crime[] {
  if (Array.isArray(payload)) return payload as Crime[];
  if (
    payload &&
    typeof payload === 'object' &&
    'items' in payload &&
    Array.isArray((payload as { items: unknown }).items)
  ) {
    return (payload as { items: Crime[] }).items;
  }
  return [];
}

function markerColor(severity: string) {
  switch (severity) {
    case 'CRITICAL':
      return COLORS.danger;
    case 'HIGH':
      return COLORS.warning;
    case 'MEDIUM':
      return '#FBBF24';
    default:
      return COLORS.success;
  }
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const queryClient = useQueryClient();
  const [region, setRegion] = useState({
    latitude: 23.8103,
    longitude: 90.4125,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');

  const { data: crimes = [], isError } = useQuery({
    queryKey: ['map-crimes', isSupabaseConfigured() ? 'supabase' : 'api'],
    queryFn: async () => {
      if (isSupabaseConfigured()) {
        try {
          return await fetchCrimesForMapFromSupabase(3000);
        } catch {
          try {
            const response = await api.get('/crimes?limit=3000');
            return crimesFromApiPayload(response.data?.data);
          } catch {
            // Both sources failed (e.g. Supabase RLS/table issue + API 404 or unreachable).
            // Return empty so map renders; user still gets realtime subscription updates if any rows arrive later.
            return [];
          }
        }
      }
      try {
        const response = await api.get('/crimes?limit=3000');
        return crimesFromApiPayload(response.data?.data);
      } catch {
        return [];
      }
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
    retry: 2,
  });

  const { data: activeSosAlerts = [], isError: sosError } = useQuery({
    queryKey: ['active-sos-alerts'],
    queryFn: async () => {
      try {
        return await fetchActiveSosAlertsFromSupabase(200);
      } catch {
        return [];
      }
    },
    enabled: isSupabaseConfigured(),
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: 2,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('mobile-live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crimes' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['map-crimes'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Crime' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['map-crimes'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'SOSRequest' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const visibleCrimes = useMemo(() => filterCrimesByAreaQuery(crimes, selectedArea), [crimes, selectedArea]);

  const markers = useMemo(
    () =>
      visibleCrimes
        .map((crime) => ({
          id: crime.id,
          latitude: Number(crime.location?.latitude),
          longitude: Number(crime.location?.longitude),
          title: crime.title || 'Incident',
          severity: String(crime.severity ?? 'LOW'),
          area: crime.location?.area || crime.location?.district || 'Unknown area',
        }))
        .filter((marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)),
    [visibleCrimes]
  );

  const sosMarkers = useMemo(
    () =>
      activeSosAlerts
        .map((alert) => ({
          id: alert.id,
          latitude: Number(alert.location?.latitude),
          longitude: Number(alert.location?.longitude),
          message: alert.message || 'Emergency assistance requested',
        }))
        .filter((marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)),
    [activeSosAlerts]
  );

  const animateToRegion = (next: typeof region) => {
    setRegion(next);
    mapRef.current?.animateToRegion(next, 500);
  };

  const searchArea = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSelectedArea('');
      return;
    }
    setSelectedArea(query);
    try {
      const hits = await Location.geocodeAsync(query);
      const first = hits[0];
      if (first) {
        animateToRegion({
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        });
      }
    } catch {
      Alert.alert('Search failed', 'The incident list was filtered, but the map could not move to that place.');
    }
  };

  const centerOnUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow location access to center the map.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      });
    } catch {
      Alert.alert('Location failed', 'Could not read your current location.');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedArea('');
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.title}
            description={`${marker.severity} • ${marker.area}`}
            pinColor={markerColor(marker.severity)}
          />
        ))}
        {sosMarkers.map((marker) => (
          <Marker
            key={`sos-${marker.id}`}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title="Live SOS alert"
            description={marker.message}
          >
            <View style={styles.sosMarker}>
              <MaterialIcons name="emergency" size={18} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={21} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search crime area"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchArea}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={clearSearch} hitSlop={10}>
              <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.searchButton} onPress={searchArea}>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.bg} />
          </TouchableOpacity>
        </View>

        {isError ? <Text style={styles.errorText}>Could not refresh incidents. Showing available map data.</Text> : null}
        {sosError ? <Text style={styles.errorText}>Could not refresh live SOS alerts.</Text> : null}
      </View>

      {sosMarkers.length > 0 ? (
        <View style={styles.liveSosBanner}>
          <MaterialIcons name="emergency-share" size={18} color="#fff" />
          <Text style={styles.liveSosText}>
            {sosMarkers.length} live SOS alert{sosMarkers.length === 1 ? '' : 's'}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.sosButton} onPress={() => router.push('/(tabs)/sos' as never)}>
        <MaterialIcons name="emergency" size={22} color="#fff" />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
        <MaterialIcons name="my-location" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  map: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    top: 52,
    left: SPACING.md,
    right: SPACING.md,
  },
  searchBar: {
    minHeight: 54,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: SPACING.sm,
    color: COLORS.warning,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  liveSosBanner: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: 104,
    minHeight: 44,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(220, 38, 38, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.card,
  },
  liveSosText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  sosMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.danger,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  sosButton: {
    position: 'absolute',
    top: 122,
    right: SPACING.md,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: COLORS.danger,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    ...SHADOWS.card,
  },
  sosText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  locationButton: {
    position: 'absolute',
    right: SPACING.md,
    bottom: 104,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    ...SHADOWS.card,
  },
});
