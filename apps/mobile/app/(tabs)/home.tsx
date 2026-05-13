import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const { width } = Dimensions.get('window');

interface Stat {
  totalCrimes: number;
  crimesByArea: Array<{ area: string; count: number; riskLevel: string }>;
  trends: Array<{ date: string; count: number }>;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: stats, refetch } = useQuery<Stat>({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await api.get('/analytics/stats');
      return response.data.data;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const highRiskAreas = stats?.crimesByArea?.filter((a: any) => 
    a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL'
  ).length || 0;
  
  const safetyScore = Math.max(72, Math.min(98, 100 - Math.floor(highRiskAreas * 4.2)));

  // Live pulse animation
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.9 + (pulse.value - 1) * 0.5,
  }));

  const quickActions = [
    { 
      icon: 'add-alert', 
      label: 'Report Incident', 
      color: COLORS.danger, 
      bg: 'rgba(255, 46, 99, 0.12)',
      onPress: () => router.push('/(tabs)/report' as never) 
    },
    { 
      icon: 'emergency', 
      label: 'Trigger SOS', 
      color: COLORS.warning, 
      bg: 'rgba(255, 149, 0, 0.12)',
      onPress: () => router.push('/(tabs)/sos' as never) 
    },
    { 
      icon: 'map', 
      label: 'Live Heatmap', 
      color: COLORS.accent, 
      bg: 'rgba(0, 229, 255, 0.12)',
      onPress: () => router.push('/(tabs)/map' as never) 
    },
    { 
      icon: 'groups', 
      label: 'Social Radar', 
      color: '#A78BFA', 
      bg: 'rgba(167, 139, 250, 0.12)',
      onPress: () => router.push('/(tabs)/community' as never) 
    },
  ];

  const recentIncidents = [
    { id: 1, type: 'Theft', area: 'Gulshan', time: '14m ago', severity: 'MEDIUM' },
    { id: 2, type: 'Assault', area: 'Mirpur', time: '47m ago', severity: 'HIGH' },
    { id: 3, type: 'Fraud', area: 'Dhanmondi', time: '2h ago', severity: 'LOW' },
  ];

  return (
    <View style={styles.screen}>
      {/* Top Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>LIVE • 1,284 reports today</Text>
        </View>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] || 'U'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={COLORS.accent} 
            colors={[COLORS.accent]} 
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Greeting */}
        <View style={styles.hero}>
          <View>
            <Text style={styles.greeting}>Good evening, {user?.name?.split(' ')[0] || 'Champion'}</Text>
            <Text style={styles.location}>📍 Dhaka, Bangladesh • 28°C</Text>
          </View>
          
          {/* Safety Score */}
          <View style={styles.scoreContainer}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreNumber}>{safetyScore}</Text>
              <Text style={styles.scoreLabel}>SAFETY SCORE</Text>
            </View>
            <View style={styles.scoreBadge}>
              <MaterialIcons name="verified" size={14} color={COLORS.success} />
              <Text style={styles.scoreBadgeText}>Excellent</Text>
            </View>
          </View>
        </View>

        {/* Live Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalCrimes?.toLocaleString() || '1,284'}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
            <View style={styles.statChange}>
              <MaterialIcons name="trending-down" size={12} color={COLORS.success} />
              <Text style={styles.changeText}>-14% from last week</Text>
            </View>
          </View>
          
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>{highRiskAreas}</Text>
            <Text style={styles.statLabel}>High-Risk Zones</Text>
            <View style={styles.statChange}>
              <MaterialIcons name="warning" size={12} color={COLORS.warning} />
              <Text style={styles.changeText}>3 new today</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.actionCard, { backgroundColor: action.bg }]} 
                onPress={action.onPress}
                activeOpacity={0.85}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                  <MaterialIcons name={action.icon as any} size={26} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Incidents Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Incidents</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/map' as never)}>
              <Text style={styles.seeAll}>View all →</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {recentIncidents.map((incident, index) => (
              <TouchableOpacity key={index} style={styles.incidentCard}>
                <View style={styles.incidentHeader}>
                  <View style={[styles.severityDot, { 
                    backgroundColor: incident.severity === 'HIGH' ? COLORS.danger : 
                                   incident.severity === 'MEDIUM' ? COLORS.warning : COLORS.success 
                  }]} />
                  <Text style={styles.incidentType}>{incident.type}</Text>
                </View>
                <Text style={styles.incidentArea}>{incident.area}</Text>
                <Text style={styles.incidentTime}>{incident.time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Safety Insight */}
        <View style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <MaterialIcons name="tips-and-updates" size={22} color={COLORS.warning} />
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Safety Insight</Text>
            <Text style={styles.insightText}>
              Avoid Gulshan &amp; Mirpur after 10 PM. 68% of incidents reported in last 48h occurred in these zones.
            </Text>
            <TouchableOpacity style={styles.insightAction}>
              <Text style={styles.insightActionText}>View Heatmap</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 54,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.glow,
  },
  avatarText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  hero: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  greeting: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  location: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  scoreContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  scoreRing: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 8,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    ...SHADOWS.glow,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -2,
  },
  scoreLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    marginTop: -4,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  scoreBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  statChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  seeAll: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionCard: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  actionLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  horizontalScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  incidentCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginRight: SPACING.md,
    width: 148,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  incidentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  incidentType: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '700',
  },
  incidentArea: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 2,
  },
  incidentTime: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 149, 0, 0.06)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.2)',
    gap: SPACING.md,
  },
  insightIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.warning,
    marginBottom: 4,
  },
  insightText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  insightAction: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: 4,
  },
  insightActionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    fontWeight: '700',
  },
});
