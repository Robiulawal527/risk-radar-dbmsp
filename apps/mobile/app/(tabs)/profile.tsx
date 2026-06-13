import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { requestNearbyNotificationPermission } from '@/lib/nearby-notifications';
import { supabase } from '@/lib/supabase';
import { PHONE_HINT, requireValidPhoneNumber } from '@/lib/validation';
import { useAuthStore } from '@/store/auth';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data;
    const apiMessage = data?.error ?? data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

export default function ProfileScreen() {
  const { user, clearAuth, patchUser } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhone(user.phone || '');
    setSkills((user.skills || []).join(', '));
    setAlertsEnabled(user.alertsEnabled !== false);
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const skillsArr = parseSkills(skills);
    let normalizedPhone = '';
    try {
      normalizedPhone = requireValidPhoneNumber(phone);
      if (phone.trim() && normalizedPhone !== phone) setPhone(normalizedPhone);
    } catch (err) {
      setSaving(false);
      Alert.alert('Invalid phone number', err instanceof Error ? err.message : PHONE_HINT);
      return;
    }
    try {
      const response = await api.put<{ success: boolean; data: Record<string, unknown> }>('/users/profile', {
        name: name.trim(),
        phone: normalizedPhone,
        skills: skillsArr,
        alertsEnabled,
      });
      const data = response.data.data ?? {};
      patchUser({
        name: String(data.name ?? name.trim()),
        phone: data.phone != null ? String(data.phone) : normalizedPhone,
        skills: Array.isArray(data.skills) ? (data.skills as string[]) : skillsArr,
        avatar: data.avatar != null ? String(data.avatar) : user.avatar,
        alertLatitude: typeof data.alertLatitude === 'number' ? data.alertLatitude : user.alertLatitude ?? null,
        alertLongitude: typeof data.alertLongitude === 'number' ? data.alertLongitude : user.alertLongitude ?? null,
        alertsEnabled: typeof data.alertsEnabled === 'boolean' ? data.alertsEnabled : alertsEnabled,
      });
      Alert.alert('Profile saved', 'Your profile and alert preferences were updated.');
    } catch (err) {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: name.trim(),
          phone: normalizedPhone,
          skills: skillsArr,
          alertsEnabled,
        },
      });

      // Also upsert to profiles table (the source of truth read by SupabaseAuthSync on hydration).
      // This makes skills (and other fields) persist reliably when the custom /users/profile API
      // is unavailable (404, network, dev setup without backend, etc).
      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email,
            full_name: name.trim() || null,
            phone: normalizedPhone || null,
            avatar: user.avatar || null,
            skills: skillsArr,
            alerts_enabled: alertsEnabled,
          },
          { onConflict: 'id' }
        );
      } catch {}

      if (!error) {
        patchUser({ name: name.trim(), phone: normalizedPhone, skills: skillsArr, alertsEnabled });
        Alert.alert('Profile saved', 'Saved through your Supabase user metadata.');
      } else {
        Alert.alert('Could not save profile', getErrorMessage(err, error.message || 'Could not save profile.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveAlertZoneFromGps = async () => {
    if (!user) return;
    try {
      setGpsLoading(true);
      const notificationsAllowed = await requestNearbyNotificationPermission();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow location access to save an alert zone.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      try {
        const response = await api.put<{ success: boolean; data: Record<string, unknown> }>('/users/profile', {
          alertLatitude: lat,
          alertLongitude: lng,
          alertsEnabled: true,
        });
        const data = response.data.data ?? {};
        patchUser({
          alertLatitude: typeof data.alertLatitude === 'number' ? data.alertLatitude : lat,
          alertLongitude: typeof data.alertLongitude === 'number' ? data.alertLongitude : lng,
          alertsEnabled: true,
        });
        setAlertsEnabled(true);
        Alert.alert(
          'Nearby alerts enabled',
          notificationsAllowed
            ? 'Crimes and SOS alerts near this point can trigger notifications.'
            : 'Your alert point was saved. Turn on app notifications in phone settings to receive nearby alerts.'
        );
      } catch (err) {
        const { error } = await supabase.auth.updateUser({
          data: { alertLatitude: lat, alertLongitude: lng, alertsEnabled: true },
        });

        // Also upsert to profiles so alert location persists for sync/hydration (profiles preferred over metadata).
        // Include full profile fields so we do not clobber name/skills/avatar etc on the view trigger.
        try {
          await supabase.from('profiles').upsert(
            {
              id: user.id,
              email: user.email,
              full_name: user.name || null,
              phone: user.phone || null,
              avatar: user.avatar || null,
              skills: user.skills || [],
              alert_latitude: lat,
              alert_longitude: lng,
              alerts_enabled: true,
            },
            { onConflict: 'id' }
          );
        } catch {}

        if (!error) {
          patchUser({ alertLatitude: lat, alertLongitude: lng, alertsEnabled: true });
          setAlertsEnabled(true);
          Alert.alert(
            'Nearby alerts enabled',
            notificationsAllowed
              ? 'Saved through your Supabase user metadata.'
              : 'Saved through your Supabase user metadata. Turn on app notifications in phone settings to receive nearby alerts.'
          );
        } else {
          Alert.alert('Could not update alert zone', getErrorMessage(err, error.message || 'Could not update alert zone.'));
        }
      }
    } catch {
      Alert.alert('Could not read GPS', 'Allow location access and try again.');
    } finally {
      setGpsLoading(false);
    }
  };

  const onLogout = async () => {
    Alert.alert('Sign out', 'End this mobile session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut().catch(() => {});
          await clearAuth();
          router.replace('/auth/login' as never);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Safety Champion'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.label}>FULL NAME</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={COLORS.textMuted} />
        <Text style={styles.label}>EMAIL</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={user?.email ?? ''} editable={false} />
        <Text style={styles.label}>PHONE NUMBER</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+880..." placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
        <Text style={styles.label}>SKILLS</Text>
        <TextInput style={styles.input} value={skills} onChangeText={setSkills} placeholder="doctor, engineer, volunteer, rescue" placeholderTextColor={COLORS.textMuted} />
        <Text style={styles.helpText}>Comma-separated skills power Social Radar search on the Community tab.</Text>
        {parseSkills(skills).length > 0 ? (
          <View style={styles.skillsPreview}>
            <Text style={styles.skillsPreviewLabel}>Your skills:</Text>
            <View style={styles.previewTags}>
              {parseSkills(skills).map((skill, index) => (
                <View key={index} style={styles.previewChip}>
                  <Text style={styles.previewChipText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchTitle}>Nearby incident notifications</Text>
            <Text style={styles.helpText}>Use the saved alert point for local crime alerts.</Text>
          </View>
          <Switch value={alertsEnabled} onValueChange={setAlertsEnabled} trackColor={{ false: '#334155', true: COLORS.accentDark }} thumbColor={alertsEnabled ? COLORS.accent : COLORS.textMuted} />
        </View>
        <TouchableOpacity style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={saveProfile} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialIcons name="location-on" size={20} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Alert Location</Text>
        </View>
        <Text style={styles.helpText}>Save home, work, or another point you care about. Nearby crimes and live SOS alerts can trigger notifications.</Text>
        {user?.alertLatitude != null && user?.alertLongitude != null ? (
          <Text style={styles.savedLocation}>Saved: {user.alertLatitude.toFixed(4)}, {user.alertLongitude.toFixed(4)}</Text>
        ) : (
          <Text style={styles.savedLocation}>No alert point saved yet.</Text>
        )}
        <TouchableOpacity style={[styles.outlineButton, gpsLoading && styles.buttonDisabled]} onPress={saveAlertZoneFromGps} disabled={gpsLoading}>
          <MaterialIcons name="my-location" size={18} color={COLORS.accent} />
          <Text style={styles.outlineButtonText}>{gpsLoading ? 'Reading GPS...' : 'Use current location as alert zone'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, styles.dangerCard]}>
        <Text style={[styles.cardTitle, { color: COLORS.danger }]}>Sign out</Text>
        <Text style={styles.helpText}>Ends this session on the mobile app.</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <MaterialIcons name="logout" size={18} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md, ...SHADOWS.glow },
  avatarText: { fontSize: 34, fontWeight: '900', color: COLORS.bg },
  name: { ...TYPOGRAPHY.h2, color: COLORS.text },
  email: { color: COLORS.textMuted, marginTop: 4 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.card },
  dangerCard: { borderColor: 'rgba(255,46,99,0.28)' },
  cardTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: SPACING.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  label: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 6, marginTop: SPACING.sm },
  input: { minHeight: 48, backgroundColor: '#111827', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.sm, color: COLORS.text, paddingHorizontal: SPACING.md, fontSize: 15 },
  disabledInput: { opacity: 0.62 },
  helpText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, marginTop: SPACING.md },
  switchTextWrap: { flex: 1 },
  switchTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  primaryButton: { backgroundColor: COLORS.accent, borderRadius: RADIUS.sm, paddingVertical: 15, alignItems: 'center', marginTop: SPACING.lg },
  primaryButtonText: { color: COLORS.bg, fontWeight: '900', fontSize: 15 },
  outlineButton: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.sm, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  outlineButtonText: { color: COLORS.text, fontWeight: '800', textAlign: 'center' },
  buttonDisabled: { opacity: 0.6 },
  savedLocation: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.md },
  logoutButton: { backgroundColor: COLORS.danger, borderRadius: RADIUS.sm, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  skillsPreview: { marginTop: SPACING.sm },
  skillsPreviewLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previewChip: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  previewChipText: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },
});
