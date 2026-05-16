import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { CrimeType, Severity, type Crime } from '@risk-radar/types';
import { api } from '@/lib/api';
import { fetchCrimesForMapFromSupabase } from '@/lib/map-crimes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';

const NEARBY_RADIUS_KM = Number(process.env.EXPO_PUBLIC_NEARBY_ALERT_RADIUS_KM ?? '10') || 10;
const BANGLADESH_CENTER = { latitude: 23.685, longitude: 90.3563 };

type PlaceContext = {
  source: 'gps' | 'search' | 'fallback';
  label: string;
  latitude: number;
  longitude: number;
  district?: string;
  division?: string;
};

type ScopeStats = {
  title: string;
  subtitle: string;
  total: number;
  topCategory: string;
  categoryRows: Array<{ name: string; value: number; color: string }>;
  severityRows: Array<{ name: Severity; value: number; color: string }>;
};

const severityColors: Record<Severity, string> = {
  LOW: COLORS.success,
  MEDIUM: '#FBBF24',
  HIGH: COLORS.warning,
  CRITICAL: COLORS.danger,
};

const categoryColors = ['#00E5FF', '#A3E635', '#FBBF24', '#FB7185', '#C084FC', '#38BDF8', '#34D399', '#F97316'];

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

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function sameText(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function containsText(value: string | undefined, query: string) {
  if (!value) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.asin(Math.sqrt(h));
}

function locationLabel(place?: Location.LocationGeocodedAddress) {
  if (!place) return {};
  const district = place.city || place.subregion || place.district || undefined;
  const division = place.region || undefined;
  const label = [place.name, place.street, place.district, place.city, place.region]
    .filter(Boolean)
    .join(', ');
  return {
    label: label || district || division || 'Current location',
    district,
    division,
  };
}

function buildScopeStats(title: string, subtitle: string, rows: Crime[]): ScopeStats {
  const categoryCounts = new Map<string, number>();
  const severityCounts = new Map<Severity, number>();

  for (const type of Object.values(CrimeType)) categoryCounts.set(type, 0);
  for (const severity of Object.values(Severity)) severityCounts.set(severity, 0);

  for (const crime of rows) {
    categoryCounts.set(crime.type, (categoryCounts.get(crime.type) ?? 0) + 1);
    severityCounts.set(crime.severity, (severityCounts.get(crime.severity) ?? 0) + 1);
  }

  const categoryRows = [...categoryCounts.entries()]
    .map(([name, value], index) => ({ name, value, color: categoryColors[index % categoryColors.length] }))
    .sort((a, b) => b.value - a.value);

  const severityRows = [...severityCounts.entries()].map(([name, value]) => ({
    name,
    value,
    color: severityColors[name],
  }));

  const top = categoryRows.find((row) => row.value > 0);

  return {
    title,
    subtitle,
    total: rows.length,
    topCategory: top ? formatLabel(top.name) : 'No reports',
    categoryRows,
    severityRows,
  };
}

function filterByDivision(crimes: Crime[], division?: string) {
  if (!division) return [];
  return crimes.filter((crime) => sameText(crime.location.division, division));
}

function filterByDistrict(crimes: Crime[], district?: string) {
  if (!district) return [];
  return crimes.filter((crime) => sameText(crime.location.district, district));
}

function filterByNearby(crimes: Crime[], context: PlaceContext) {
  return crimes.filter((crime) => {
    const latitude = Number(crime.location.latitude);
    const longitude = Number(crime.location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    return distanceKm(context, { latitude, longitude }) <= NEARBY_RADIUS_KM;
  });
}

function filterBySearchText(crimes: Crime[], query: string) {
  const q = query.trim();
  if (!q) return crimes;
  return crimes.filter((crime) =>
    [
      crime.location.division,
      crime.location.district,
      crime.location.area,
      crime.location.address,
      crime.title,
      crime.description,
    ].some((value) => containsText(value, q))
  );
}

export default function AnalyticsScreen() {
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [context, setContext] = useState<PlaceContext>({
    source: 'fallback',
    label: 'Bangladesh',
    ...BANGLADESH_CENTER,
  });
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

  const { data: crimes = [], isLoading, isError, refetch } = useQuery<Crime[]>({
    queryKey: ['analytics-crimes', isSupabaseConfigured() ? 'supabase' : 'api'],
    queryFn: async () => {
      if (isSupabaseConfigured()) {
        try {
          return await fetchCrimesForMapFromSupabase(5000);
        } catch {
          const response = await api.get('/crimes?limit=5000');
          return crimesFromApiPayload(response.data?.data);
        }
      }
      const response = await api.get('/crimes?limit=5000');
      return crimesFromApiPayload(response.data?.data);
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const updateContextFromCoords = async (latitude: number, longitude: number, source: PlaceContext['source']) => {
    const reverse = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
    const details = locationLabel(reverse[0]);
    setContext({
      source,
      latitude,
      longitude,
      label: details.label || (source === 'search' ? searchedQuery || 'Selected place' : 'Current location'),
      district: details.district,
      division: details.division,
    });
  };

  useEffect(() => {
    let mounted = true;
    const startLocation = async () => {
      try {
        setLocating(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        await updateContextFromCoords(position.coords.latitude, position.coords.longitude, 'gps');
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 650,
            timeInterval: 45_000,
          },
          (next) => {
            if (!searchQuery.trim() && !searchedQuery.trim()) {
              void updateContextFromCoords(next.coords.latitude, next.coords.longitude, 'gps');
            }
          }
        );
      } finally {
        if (mounted) setLocating(false);
      }
    };

    void startLocation();
    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, [searchedQuery, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    if (context.source !== 'search') {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (position) await updateContextFromCoords(position.coords.latitude, position.coords.longitude, 'gps');
    }
    setRefreshing(false);
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchedQuery('');
      return;
    }

    setSearching(true);
    try {
      const results = await Location.geocodeAsync(`${query}, Bangladesh`);
      const first = results[0];
      if (!first) {
        Alert.alert('No Bangladesh match', 'Try a district, division, city, or nearby landmark in Bangladesh.');
        return;
      }
      setSearchedQuery(query);
      await updateContextFromCoords(first.latitude, first.longitude, 'search');
    } catch {
      Alert.alert('Search failed', 'Could not search that place right now.');
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = async () => {
    setSearchQuery('');
    setSearchedQuery('');
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow location access to show nearby analytics.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await updateContextFromCoords(position.coords.latitude, position.coords.longitude, 'gps');
    } catch {
      Alert.alert('Location failed', 'Could not read your current location.');
    } finally {
      setLocating(false);
    }
  };

  const scopes = useMemo(() => {
    const textRows = searchedQuery ? filterBySearchText(crimes, searchedQuery) : crimes;
    const divisionRows = filterByDivision(crimes, context.division);
    const districtRows = filterByDistrict(crimes, context.district);
    const nearbyRows = filterByNearby(crimes, context);
    const fallbackRows = searchedQuery ? textRows : [];

    return {
      division: buildScopeStats(
        'Division',
        context.division ? `${context.division} division` : 'Current division not detected yet',
        divisionRows.length ? divisionRows : fallbackRows
      ),
      district: buildScopeStats(
        'District',
        context.district ? `${context.district} district` : 'Current district not detected yet',
        districtRows.length ? districtRows : fallbackRows
      ),
      nearby: buildScopeStats(
        'Nearby',
        `${NEARBY_RADIUS_KM} km around ${context.source === 'search' ? 'searched place' : 'you'}`,
        nearbyRows
      ),
    };
  }, [context, crimes, searchedQuery]);

  const primaryScope = scopes.nearby;
  const topNearbyCategory = primaryScope.topCategory;
  const maxNearbyCategory = Math.max(1, ...primaryScope.categoryRows.map((row) => row.value));
  const maxDistrictCategory = Math.max(1, ...scopes.district.categoryRows.map((row) => row.value));
  const totalContextReports = scopes.division.total + scopes.district.total + scopes.nearby.total;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="query-stats" size={24} color={COLORS.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Local Analytics</Text>
          <Text style={styles.subtitle}>Bangladesh-only report signals around your current or searched place.</Text>
        </View>
      </View>

      <View style={styles.searchShell}>
        <View style={styles.searchBar}>
          <MaterialIcons name="travel-explore" size={21} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search district, division, city"
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchedQuery('');
              }}
              hitSlop={10}
            >
              <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.iconButton} onPress={runSearch} disabled={searching}>
            <MaterialIcons name={searching ? 'hourglass-empty' : 'arrow-forward'} size={20} color={COLORS.bg} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.locationButton} onPress={useCurrentLocation} disabled={locating}>
          <MaterialIcons name="my-location" size={18} color={COLORS.accent} />
          <Text style={styles.locationButtonText}>{locating ? 'Updating location...' : 'Use phone location'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contextPanel}>
        <View style={styles.contextTop}>
          <View style={styles.contextIcon}>
            <MaterialIcons name={context.source === 'search' ? 'place' : 'gps-fixed'} size={22} color="#fff" />
          </View>
          <View style={styles.contextText}>
            <Text style={styles.contextLabel} numberOfLines={1}>
              {context.label}
            </Text>
            <Text style={styles.contextMeta} numberOfLines={1}>
              {[context.district, context.division].filter(Boolean).join(' • ') || 'Bangladesh context'}
            </Text>
          </View>
        </View>
        <View style={styles.contextStats}>
          <MiniStat label="Nearby reports" value={String(primaryScope.total)} tone="accent" />
          <MiniStat label="Top nearby" value={topNearbyCategory} tone="warning" />
        </View>
      </View>

      {isError ? <Text style={styles.warning}>Could not refresh analytics. Pull to retry.</Text> : null}
      {isLoading ? <ActivityIndicator color={COLORS.accent} style={styles.loader} /> : null}

      <View style={styles.scopeGrid}>
        <ScopeCard scope={scopes.division} icon="public" color="#38BDF8" />
        <ScopeCard scope={scopes.district} icon="location-city" color="#A3E635" />
        <ScopeCard scope={scopes.nearby} icon="radar" color="#FB7185" emphasized />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Category Mix</Text>
          <Text style={styles.sectionMeta}>{primaryScope.total} reports in {NEARBY_RADIUS_KM} km</Text>
        </View>
        <View style={styles.categoryList}>
          {primaryScope.categoryRows.slice(0, 6).map((row) => (
            <BarRow key={row.name} label={formatLabel(row.name)} value={row.value} max={maxNearbyCategory} color={row.color} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Severity</Text>
          <Text style={styles.sectionMeta}>Operational urgency</Text>
        </View>
        <View style={styles.severityGrid}>
          {primaryScope.severityRows.map((row) => (
            <SeverityTile key={row.name} name={row.name} value={row.value} color={row.color} total={primaryScope.total} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>District Categories</Text>
          <Text style={styles.sectionMeta}>{scopes.district.subtitle}</Text>
        </View>
        {scopes.district.categoryRows.slice(0, 5).map((row) => (
          <BarRow key={row.name} label={formatLabel(row.name)} value={row.value} max={maxDistrictCategory} color={row.color} />
        ))}
      </View>

      <View style={styles.footerSummary}>
        <MaterialIcons name="insights" size={19} color={COLORS.accent} />
        <Text style={styles.footerText}>
          Showing {totalContextReports.toLocaleString()} scoped report references from stored Bangladesh incident data.
        </Text>
      </View>
    </ScrollView>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'accent' | 'warning' }) {
  const color = tone === 'accent' ? COLORS.accent : COLORS.warning;
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function ScopeCard({
  scope,
  icon,
  color,
  emphasized,
}: {
  scope: ScopeStats;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.scopeCard, emphasized && styles.scopeCardHot]}>
      <View style={[styles.scopeIcon, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.scopeTitle}>{scope.title}</Text>
      <Text style={styles.scopeSubtitle} numberOfLines={2}>{scope.subtitle}</Text>
      <Text style={styles.scopeNumber}>{scope.total.toLocaleString()}</Text>
      <Text style={styles.scopeCaption}>reports</Text>
      <Text style={[styles.scopeTop, { color }]} numberOfLines={1}>
        {scope.topCategory}
      </Text>
    </View>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(value / max) * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function SeverityTile({ name, value, color, total }: { name: Severity; value: number; color: string; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.severityTile}>
      <View style={[styles.severityDot, { backgroundColor: color }]} />
      <Text style={styles.severityName}>{name}</Text>
      <Text style={styles.severityValue}>{value}</Text>
      <Text style={styles.severityPercent}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 229, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text, fontSize: 29, letterSpacing: 0 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 4 },
  searchShell: { gap: SPACING.sm, marginBottom: SPACING.md },
  searchBar: {
    minHeight: 54,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '700' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButton: {
    minHeight: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.22)',
    backgroundColor: 'rgba(0, 229, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  locationButtonText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  contextPanel: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  contextTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  contextIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextText: { flex: 1 },
  contextLabel: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  contextMeta: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  contextStats: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  miniStat: {
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.055)',
    padding: SPACING.md,
  },
  miniLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800' },
  miniValue: { fontSize: 20, fontWeight: '900', marginTop: 5 },
  warning: { color: COLORS.warning, marginBottom: SPACING.md, textAlign: 'center', fontWeight: '700' },
  loader: { marginBottom: SPACING.md },
  scopeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  scopeCard: {
    width: '31.8%',
    minHeight: 170,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    ...SHADOWS.card,
  },
  scopeCardHot: { borderColor: 'rgba(251, 113, 133, 0.55)', backgroundColor: 'rgba(136, 19, 55, 0.22)' },
  scopeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  scopeTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  scopeSubtitle: { color: COLORS.textMuted, fontSize: 10, lineHeight: 14, marginTop: 3, minHeight: 28 },
  scopeNumber: { color: COLORS.text, fontSize: 25, fontWeight: '900', marginTop: SPACING.sm },
  scopeCaption: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },
  scopeTop: { fontSize: 11, fontWeight: '900', marginTop: SPACING.sm },
  section: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  sectionHeader: { marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  categoryList: { gap: SPACING.sm },
  barRow: { marginBottom: SPACING.sm },
  barHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  barLabel: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '800' },
  barValue: { color: COLORS.textMuted, fontSize: 12, fontWeight: '900' },
  track: {
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    overflow: 'hidden',
    marginTop: 7,
  },
  fill: { height: '100%', minWidth: 3, borderRadius: 5 },
  severityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  severityTile: {
    width: '47.8%',
    minHeight: 98,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.055)',
    padding: SPACING.md,
  },
  severityDot: { width: 10, height: 10, borderRadius: 5, marginBottom: SPACING.sm },
  severityName: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900' },
  severityValue: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 3 },
  severityPercent: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800' },
  footerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 200, 83, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.22)',
    padding: SPACING.md,
  },
  footerText: { flex: 1, color: COLORS.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
