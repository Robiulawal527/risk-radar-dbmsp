import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MaterialIcons } from '@expo/vector-icons';

export default function CommunityScreen() {
  const { data: matches } = useQuery({
    queryKey: ['social-radar'],
    queryFn: async () => {
      const response = await api.get('/analytics/social-radar?interests=Public Safety,Community Watch');
      return response.data.data;
    },
  });

  const { data: rankings } = useQuery({
    queryKey: ['rankings'],
    queryFn: async () => {
      const [criminals, philanthropists] = await Promise.all([
        api.get('/analytics/rankings/criminals'),
        api.get('/analytics/rankings/philanthropists'),
      ]);
      return {
        criminals: criminals.data.data,
        philanthropists: philanthropists.data.data,
      };
    },
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community Radar</Text>
        <Text style={styles.subtitle}>Trusted connections & safety leaders</Text>
      </View>

      {/* Social Radar */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="people" size={20} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>Social Radar Matches</Text>
        </View>
        
        {matches?.slice(0, 3).map((match: any, index: number) => (
          <View key={index} style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{match.name?.[0] || 'U'}</Text>
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.matchName}>{match.name}</Text>
                <Text style={styles.matchScore}>{match.compatibilityScore}% match</Text>
              </View>
              <View style={styles.trustBadge}>
                <Text style={styles.trustScore}>{match.trustScore}</Text>
              </View>
            </View>
            <View style={styles.matchTags}>
              {match.interests?.slice(0, 3).map((tag: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Top Contributors */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="emoji-events" size={20} color="#fbbf24" />
          <Text style={styles.sectionTitle}>Top Safety Champions</Text>
        </View>
        
        {rankings?.philanthropists?.slice(0, 4).map((champ: any, index: number) => (
          <View key={index} style={styles.championCard}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{champ.rank}</Text>
            </View>
            <Text style={styles.championName}>{champ.name}</Text>
            <Text style={styles.championStats}>
              {champ.reportsSubmitted} reports • {Math.round(champ.accuracy * 100)}% accuracy
            </Text>
          </View>
        ))}
      </View>

      {/* Most Wanted */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="gavel" size={20} color="#ef4444" />
          <Text style={styles.sectionTitle}>Most Wanted</Text>
        </View>
        
        {rankings?.criminals?.slice(0, 3).map((criminal: any, index: number) => (
          <View key={index} style={styles.criminalCard}>
            <View style={styles.criminalHeader}>
              <Text style={styles.criminalName}>{criminal.criminalInfo?.name || 'Redacted'}</Text>
              <View style={[styles.dangerBadge, { backgroundColor: criminal.dangerLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b' }]}>
                <Text style={styles.dangerText}>{criminal.dangerLevel}</Text>
              </View>
            </View>
            <Text style={styles.criminalDesc}>{criminal.criminalInfo?.description}</Text>
            <Text style={styles.criminalStats}>
              {criminal.crimeCount} incidents • {criminal.mostFrequentCrime}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  matchName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  matchScore: {
    color: '#22d3ee',
    fontSize: 12,
    marginTop: 2,
  },
  trustBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  trustScore: {
    color: '#020617',
    fontWeight: '700',
    fontSize: 13,
  },
  matchTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#1e2937',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  championCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#020617',
    fontWeight: '800',
    fontSize: 12,
  },
  championName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  championStats: {
    color: '#64748b',
    fontSize: 11,
  },
  criminalCard: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  criminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  criminalName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dangerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dangerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  criminalDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  criminalStats: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6,
  },
});
