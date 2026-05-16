import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import type { CrimeStats, Severity } from '@risk-radar/types';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';

const EMPTY_STATS: CrimeStats = {
  totalCrimes: 0,
  crimesByType: {
    THEFT: 0,
    ROBBERY: 0,
    ASSAULT: 0,
    BURGLARY: 0,
    FRAUD: 0,
    VANDALISM: 0,
    HARASSMENT: 0,
    OTHER: 0,
  },
  crimesBySeverity: {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  },
  crimesByArea: [],
  trends: [],
};

const severityColors: Record<Severity, string> = {
  LOW: COLORS.success,
  MEDIUM: '#FBBF24',
  HIGH: COLORS.warning,
  CRITICAL: COLORS.danger,
};

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { data = EMPTY_STATS, isLoading, isError, refetch } = useQuery<CrimeStats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: CrimeStats }>('/analytics/stats');
      return response.data.data ?? EMPTY_STATS;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const categories = useMemo(
    () =>
      Object.entries(data.crimesByType)
        .map(([name, value]) => ({ name, value: Number(value) || 0 }))
        .sort((a, b) => b.value - a.value),
    [data.crimesByType]
  );

  const severities = useMemo(
    () =>
      (Object.entries(data.crimesBySeverity) as [Severity, number][]).map(([name, value]) => ({
        name,
        value: Number(value) || 0,
      })),
    [data.crimesBySeverity]
  );

  const trends = data.trends.slice(-14);
  const topCategory = categories[0] ?? { name: 'OTHER', value: 0 };
  const avgDaily =
    data.trends.length > 0
      ? Math.round(data.trends.reduce((sum, row) => sum + row.count, 0) / data.trends.length)
      : 0;
  const highRiskAreas = data.crimesByArea.filter(
    (row) => row.riskLevel === 'HIGH' || row.riskLevel === 'CRITICAL'
  ).length;
  const maxCategory = Math.max(1, ...categories.map((row) => row.value));
  const maxTrend = Math.max(1, ...trends.map((row) => row.count));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="query-stats" size={26} color={COLORS.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Crime Analytics</Text>
          <Text style={styles.subtitle}>Live intelligence from your Risk Radar database</Text>
        </View>
      </View>

      {isError ? <Text style={styles.warning}>Could not load analytics. Pull to retry.</Text> : null}
      {isLoading ? <ActivityIndicator color={COLORS.accent} style={styles.loader} /> : null}

      <View style={styles.metricsGrid}>
        <Metric label="TOTAL REPORTS" value={data.totalCrimes.toLocaleString()} icon="warning" note="Database records" />
        <Metric label="DAILY AVERAGE" value={String(avgDaily)} icon="trending-up" note="30-day window" />
        <Metric label="TOP CATEGORY" value={label(topCategory.name)} icon="emoji-events" note={`${topCategory.value} reports`} />
        <Metric label="HIGH-RISK AREAS" value={String(highRiskAreas)} icon="groups" note="HIGH / CRITICAL" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Crime Categories</Text>
        <Text style={styles.cardSubtitle}>All-time distribution in the database</Text>
        <View style={styles.barList}>
          {categories.map((row) => (
            <View key={row.name} style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>{label(row.name)}</Text>
                <Text style={styles.barValue}>{row.value}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(row.value / maxCategory) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Severity Breakdown</Text>
        <Text style={styles.cardSubtitle}>Operational urgency levels</Text>
        {severities.map((row) => (
          <View key={row.name} style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.severityLabel}>
                <Text style={{ color: severityColors[row.name] }}>● </Text>
                {row.name}
              </Text>
              <Text style={styles.barValue}>{row.value}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${data.totalCrimes > 0 ? (row.value / data.totalCrimes) * 100 : 0}%`,
                    backgroundColor: severityColors[row.name],
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>30-Day Trend</Text>
        <Text style={styles.cardSubtitle}>Daily incident volume from stored reports</Text>
        <View style={styles.trendWrap}>
          {(trends.length ? trends : [{ date: 'No data', count: 0 }]).map((row, index) => (
            <View key={`${row.date}-${index}`} style={styles.trendColumn}>
              <View style={[styles.trendBar, { height: Math.max(4, (row.count / maxTrend) * 92) }]} />
              <Text style={styles.trendValue}>{row.count}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, icon, note }: { label: string; value: string; icon: keyof typeof MaterialIcons.glyphMap; note: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <MaterialIcons name={icon} size={20} color={COLORS.accent} />
      </View>
      <Text style={styles.metricValue} numberOfLines={2} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 110 },
  header: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', marginBottom: SPACING.lg },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 4 },
  warning: { color: COLORS.warning, marginBottom: SPACING.md },
  loader: { marginBottom: SPACING.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  metricCard: {
    width: '47.8%',
    minHeight: 128,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  metricLabel: { ...TYPOGRAPHY.small, color: COLORS.textMuted, fontWeight: '700', flex: 1 },
  metricValue: { color: COLORS.text, fontSize: 25, fontWeight: '900', marginTop: SPACING.md },
  metricNote: { ...TYPOGRAPHY.caption, color: COLORS.success, marginTop: SPACING.xs },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  cardTitle: { ...TYPOGRAPHY.h3, color: COLORS.text },
  cardSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 3, marginBottom: SPACING.md },
  barList: { gap: SPACING.sm },
  barRow: { marginBottom: SPACING.md },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, marginBottom: SPACING.xs },
  barLabel: { color: COLORS.text, fontSize: 13, fontWeight: '600', flex: 1 },
  severityLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  barValue: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  track: { height: 9, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full, backgroundColor: COLORS.accent },
  trendWrap: { height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: SPACING.md },
  trendColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '100%', minWidth: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  trendValue: { color: COLORS.textMuted, fontSize: 9, marginTop: 4 },
});
