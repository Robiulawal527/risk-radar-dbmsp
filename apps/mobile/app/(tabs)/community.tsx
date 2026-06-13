import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import type { SocialRadarMatch } from '@risk-radar/types';
import { fetchCommunityRankings } from '@/lib/rankings';
import { searchProfilesBySkill } from '@/lib/supabase-data';
import { useAuthStore } from '@/store/auth';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export default function CommunityScreen() {
  const { user } = useAuthStore();
  const [skillSearch, setSkillSearch] = useState('');

  const matchMutation = useMutation({
    mutationFn: async (skill: string) => {
      return await searchProfilesBySkill(skill);
    },
    onSuccess: (rows) => {
      if (!rows.length) Alert.alert('No matches yet', 'Try a different skill.');
    },
    onError: () => Alert.alert('Search failed', 'Could not load matching community members.'),
  });

  const {
    data: rankings,
    isError: rankingsError,
    isLoading: rankingsLoading,
  } = useQuery({
    queryKey: ['community-rankings'],
    queryFn: fetchCommunityRankings,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const savedSkills = user?.skills ?? [];
  const matches = matchMutation.data ?? [];

  const runSearch = (skill?: string) => {
    const query = (skill ?? skillSearch).trim();
    if (!query) {
      Alert.alert('Enter a skill', 'Search by a skill such as doctor, engineer, or volunteer.');
      return;
    }
    setSkillSearch(query);
    matchMutation.mutate(query);
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Could not open link', url));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerPanel}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="groups" size={26} color={COLORS.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Community</Text>
          <Text style={styles.subtitle}>
            Find skilled helpers, top reporters, and verified records
          </Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <Text style={styles.label}>FIND PEOPLE BY SKILL</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="doctor, engineer, web developer"
            placeholderTextColor={COLORS.textMuted}
            value={skillSearch}
            onChangeText={setSkillSearch}
            onSubmitEditing={() => runSearch()}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => runSearch()}
            disabled={matchMutation.isPending}
          >
            <MaterialIcons name="search" size={22} color={COLORS.bg} />
          </TouchableOpacity>
        </View>
        {savedSkills.length > 0 ? (
          <View style={styles.tags}>
            {savedSkills.map((skill) => (
              <TouchableOpacity
                key={skill}
                style={styles.skillChip}
                onPress={() => runSearch(skill)}
              >
                <Text style={styles.skillText}>{skill}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconPurple}>
            <MaterialIcons name="people" size={18} color="#c4b5fd" />
          </View>
          <Text style={styles.sectionTitle}>Social Radar Matches</Text>
        </View>
        {matchMutation.isPending ? <Text style={styles.emptyText}>Searching...</Text> : null}
        {!matchMutation.isPending && matches.length === 0 ? (
          <Text style={styles.emptyText}>Enter a skill, then run a search.</Text>
        ) : (
          matches.map((match) => (
            <View key={match.id || match.userId} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(match.name || match.email || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName} numberOfLines={1}>
                    {match.name}
                  </Text>
                  <Text style={styles.matchEmail} numberOfLines={1}>
                    {match.email}
                  </Text>
                  <View style={styles.verifiedRow}>
                    <MaterialIcons name="check-circle" size={13} color={COLORS.accent} />
                    <Text style={styles.verifiedText}>Verified Profile</Text>
                  </View>
                </View>
              </View>
              <View style={styles.tags}>
                {(match.skills || []).length > 0 ? (
                  match.skills.map((skill) => (
                    <View key={skill} style={styles.tag}>
                      <Text style={styles.tagText}>{skill}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>No skills listed</Text>
                )}
              </View>
              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={[styles.contactButton, !match.phone && styles.contactDisabled]}
                  disabled={!match.phone}
                  onPress={() => match.phone && openLink(`tel:${match.phone}`)}
                >
                  <MaterialIcons
                    name="phone"
                    size={17}
                    color={match.phone ? COLORS.bg : COLORS.textMuted}
                  />
                  <Text
                    style={[styles.contactButtonText, !match.phone && styles.contactDisabledText]}
                  >
                    {match.phone ? 'Call' : 'No Phone'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emailButton}
                  onPress={() => openLink(`mailto:${match.email}`)}
                >
                  <MaterialIcons name="mail" size={17} color={COLORS.text} />
                  <Text style={styles.emailButtonText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconGold}>
            <MaterialIcons name="emoji-events" size={18} color="#fbbf24" />
          </View>
          <Text style={styles.sectionTitle}>Volunteer Ranking</Text>
        </View>
        {rankingsLoading ? <Text style={styles.emptyText}>Loading rankings...</Text> : null}
        {rankingsError ? <Text style={styles.emptyText}>Could not load rankings.</Text> : null}
        {!rankingsLoading &&
        !rankingsError &&
        (rankings?.philanthropists ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No volunteer activity yet. (Admins: use Admin tab &gt; Rankings &gt; "Seed demo volunteers")</Text>
        ) : null}
        {rankings?.philanthropists?.slice(0, 5).map((champ) => (
          <View key={champ.userId} style={styles.championCard}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{champ.rank}</Text>
            </View>
            <View style={styles.rankInfo}>
              <Text style={styles.championName}>{champ.name}</Text>
              <Text style={styles.championStats}>
                {champ.reportsSubmitted} activities • {(champ.accuracy * 10).toFixed(1)} intensity
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconRed}>
            <MaterialIcons name="gavel" size={18} color={COLORS.danger} />
          </View>
          <Text style={styles.sectionTitle}>Criminal Records</Text>
        </View>
        {rankingsLoading ? <Text style={styles.emptyText}>Loading criminal records...</Text> : null}
        {rankingsError ? <Text style={styles.emptyText}>Could not load criminal records.</Text> : null}
        {!rankingsLoading &&
        !rankingsError &&
        (rankings?.criminals ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No criminal records yet. (Admins: use Admin tab &gt; Rankings panel &gt; "Seed demo criminals" for showcase.)</Text>
        ) : null}
        {rankings?.criminals?.slice(0, 5).map((criminal) => (
          <View key={`${criminal.rank}-${criminal.criminalInfo.name}`} style={styles.criminalCard}>
            <View style={styles.criminalHeader}>
              <Text style={styles.criminalName} numberOfLines={1}>
                #{criminal.rank} {criminal.criminalInfo.name}
              </Text>
              <View
                style={[
                  styles.dangerBadge,
                  criminal.dangerLevel === 'CRITICAL' ? styles.criticalBadge : styles.highBadge,
                ]}
              >
                <Text style={styles.dangerText}>{criminal.dangerLevel}</Text>
              </View>
            </View>
            <Text style={styles.criminalDesc} numberOfLines={3}>
              {criminal.criminalInfo.description}
            </Text>
            <Text style={styles.criminalStats}>
              {criminal.crimeCount} linked incidents •{' '}
              {String(criminal.mostFrequentCrime).replace(/_/g, ' ')}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 120 },
  headerPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 26,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  searchCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 22,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    ...SHADOWS.card,
  },
  label: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900', marginBottom: SPACING.sm },
  searchRow: { flexDirection: 'row', gap: SPACING.sm },
  searchInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.full,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  skillChip: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  skillText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  section: { marginBottom: SPACING.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionIconPurple: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(139,92,246,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconGold: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(251,191,36,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconRed: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,46,99,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.text },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.lg },
  matchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  matchHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.md,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  matchInfo: { flex: 1, marginLeft: SPACING.md },
  matchName: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  matchEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  verifiedText: { color: COLORS.accent, fontSize: 11, fontWeight: '700' },
  tag: { backgroundColor: '#1e2937', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  tagText: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  muted: { color: COLORS.textMuted, fontSize: 12, fontStyle: 'italic' },
  contactRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  contactButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  contactDisabled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  contactButtonText: { color: COLORS.bg, fontWeight: '900' },
  contactDisabledText: { color: COLORS.textMuted },
  emailButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.sm,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  emailButtonText: { color: COLORS.text, fontWeight: '800' },
  championCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: 18,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fbbf24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { color: COLORS.bg, fontWeight: '900', fontSize: 12 },
  rankInfo: { flex: 1, marginLeft: SPACING.md },
  championName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  championStats: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  criminalCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: 18,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  criminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  criminalName: { color: COLORS.text, fontSize: 15, fontWeight: '800', flex: 1 },
  dangerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  criticalBadge: { backgroundColor: COLORS.danger },
  highBadge: { backgroundColor: COLORS.warning },
  dangerText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  criminalDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  criminalStats: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
});
