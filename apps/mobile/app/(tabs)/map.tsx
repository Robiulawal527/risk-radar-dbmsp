import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

interface CrimeMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  severity: string;
  area?: string;
}

function crimesFromApiPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (
    payload &&
    typeof payload === 'object' &&
    'items' in payload &&
    Array.isArray((payload as { items: unknown }).items)
  ) {
    return (payload as { items: Record<string, unknown>[] }).items;
  }
  return [];
}

function heatmapFromApiPayload(payload: unknown): Record<string, unknown>[] {
  return Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
}

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState({
    latitude: 23.8103,
    longitude: 90.4125,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const { data: heatmapData } = useQuery({
    queryKey: ['heatmap'],
    queryFn: async () => {
      const response = await api.get('/heatmap');
      return heatmapFromApiPayload(response.data?.data);
    },
  });

  const { data: recentCrimes } = useQuery({
    queryKey: ['recent-crimes'],
    queryFn: async () => {
      const response = await api.get('/crimes?limit=100');
      return crimesFromApiPayload(response.data?.data);
    },
  });

  const heatmapPoints: HeatmapPoint[] =
    heatmapData?.map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      weight: Number(point.intensity ?? 0.7),
    })) ?? [];

  const crimeMarkers: CrimeMarker[] = (recentCrimes || [])
    .map((crime) => {
      const loc = crime.location as { latitude?: number; longitude?: number; area?: string } | undefined;
      const lat = loc?.latitude ?? crime.latitude;
      const lng = loc?.longitude ?? crime.longitude;
      return {
        raw: crime,
        lat: typeof lat === 'number' ? lat : Number(lat),
        lng: typeof lng === 'number' ? lng : Number(lng),
        loc,
      };
    })
    .filter(
      (row) =>
        row.raw &&
        !Number.isNaN(row.lat) &&
        !Number.isNaN(row.lng) &&
        row.lat !== 0 &&
        row.lng !== 0
    )
    .filter((row) => {
      if (selectedFilter === 'ALL') return true;
      return row.raw.severity === selectedFilter;
    })
    .slice(0, 24)
    .map((row) => ({
      id: String(row.raw.id),
      latitude: row.lat,
      longitude: row.lng,
      title: String(row.raw.title ?? ''),
      severity: String(row.raw.severity ?? ''),
      area: row.loc?.area,
    }));

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return COLORS.danger;
      case 'HIGH': return COLORS.warning;
      case 'MEDIUM': return '#FBBF24';
      default: return COLORS.success;
    }
  };

  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'];

  const centerOnUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not get your location.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Search & Filters */}
      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search area (Gulshan, Mirpur...)"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {filters.map((filter, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.filterChip,
                selectedFilter === filter && styles.filterChipActive
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === filter && styles.filterTextActive
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={userLocation}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
      >
        {showHeatmap && heatmapPoints.length > 0 && (
          <Heatmap
            points={heatmapPoints}
            radius={48}
            opacity={0.7}
            gradient={{
              colors: ['#22C55E', '#EAB308', '#F59E0B', '#EF4444'],
              startPoints: [0.0, 0.35, 0.65, 1.0],
              colorMapSize: 256,
            }}
          />
        )}

        {crimeMarkers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            title={marker.title}
            description={`${marker.severity} • ${marker.area || ''}`}
            pinColor={getSeverityColor(marker.severity)}
          />
        ))}
      </MapView>

      {/* Floating Controls */}
      <View style={styles.floatingControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={centerOnUser}>
          <MaterialIcons name="my-location" size={20} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlBtn, showHeatmap && styles.controlBtnActive]} 
          onPress={() => setShowHeatmap(!showHeatmap)}
        >
          <MaterialIcons name="layers" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>RISK INTENSITY</Text>
        <View style={styles.legendRow}>
          {[
            { label: 'Safe', color: COLORS.success },
            { label: 'Medium', color: '#FBBF24' },
            { label: 'High', color: COLORS.warning },
            { label: 'Critical', color: COLORS.danger },
          ].map((item, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.legendNote}>Data updates every 60s • Tap markers for details</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    marginLeft: SPACING.sm,
  },
  filters: {
    marginTop: SPACING.sm,
  },
  filterChip: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: COLORS.bg,
    fontWeight: '700',
  },
  map: {
    flex: 1,
  },
  floatingControls: {
    position: 'absolute',
    top: 110,
    right: SPACING.lg,
    gap: SPACING.sm,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  controlBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  legend: {
    position: 'absolute',
    bottom: 24,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  legendTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.text,
    fontWeight: '500',
  },
  legendNote: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
