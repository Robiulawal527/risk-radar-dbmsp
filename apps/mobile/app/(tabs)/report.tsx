import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { CrimeType, Severity } from '@risk-radar/types';
import { submitCrimeReport } from '@/lib/supabase-data';
import { useAuthStore } from '@/store/auth';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';

const CRIME_TYPES = Object.values(CrimeType) as CrimeType[];
const SEVERITIES = Object.values(Severity) as Severity[];
const TITLE_MIN = 4;
const DESC_MIN = 20;
const AREA_MIN = 3;

type IncidentLocation = {
  latitude: number;
  longitude: number;
  address?: string;
  area: string;
  district?: string;
  division?: string;
};

function formatCrimeLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function locationLabel(place?: Location.LocationGeocodedAddress) {
  if (!place) return {};
  const area = place.district || place.subregion || place.city || place.street || place.name || 'GPS fix';
  const district = place.city || place.subregion || place.district || undefined;
  const division = place.region || undefined;
  const address = [place.name, place.street, place.district, place.city, place.region, place.country]
    .filter(Boolean)
    .join(', ');
  return { area, district, division, address };
}

export default function ReportScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CrimeType>(CrimeType.THEFT);
  const [severity, setSeverity] = useState<Severity>(Severity.MEDIUM);
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [district, setDistrict] = useState('');
  const [division, setDivision] = useState('');
  const [location, setLocation] = useState<IncidentLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [touched, setTouched] = useState(false);

  const applyLocation = (next: IncidentLocation) => {
    setLocation(next);
    setAddress(next.address || '');
    setArea(next.area);
    setDistrict(next.district || '');
    setDivision(next.division || '');
  };

  const getCurrentLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please enable location access to report incidents accurately.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const reverse = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }).catch(() => []);
      const details = locationLabel(reverse[0]);
      applyLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        area: details.area || area || 'GPS fix',
        district: details.district || district || undefined,
        division: details.division || division || undefined,
        address: details.address || address || undefined,
      });
      Alert.alert('Location captured', 'Address fields and map coordinates were filled from GPS. You can edit the labels.');
    } catch {
      Alert.alert('Error', 'Could not get your location. Check GPS and try again.');
    } finally {
      setLocating(false);
    }
  };

  const findTypedLocation = async () => {
    const query = [address, area, district, division].filter(Boolean).join(', ');
    if (query.trim().length < 2) {
      Alert.alert('Type a place first', 'Enter an address, area, district, or division to locate it.');
      return;
    }

    try {
      setLocating(true);
      const results = await Location.geocodeAsync(query);
      const first = results[0];
      if (!first) {
        Alert.alert('No map match found', 'Try a nearby landmark or a more specific address.');
        return;
      }
      applyLocation({
        latitude: first.latitude,
        longitude: first.longitude,
        area: area.trim() || address.trim() || 'Matched place',
        district: district.trim() || undefined,
        division: division.trim() || undefined,
        address: address.trim() || query,
      });
      Alert.alert('Location matched', 'Coordinates were filled from your typed location.');
    } catch {
      Alert.alert('Location failed', 'Could not find that location right now.');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    setTouched(true);
    const titleOk = title.trim().length >= TITLE_MIN;
    const descOk = description.trim().length >= DESC_MIN;
    const areaOk = area.trim().length >= AREA_MIN;
    const coordOk =
      location &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180;

    if (!titleOk) {
      Alert.alert('Add a clearer title', `Use at least ${TITLE_MIN} characters so others can understand the incident.`);
      return;
    }
    if (!descOk) {
      Alert.alert('Add more detail', `Use at least ${DESC_MIN} characters: time, what happened, and anything notable.`);
      return;
    }
    if (!areaOk) {
      Alert.alert('Location label needed', 'Enter a neighborhood or landmark so responders can orient quickly.');
      return;
    }
    if (!coordOk) {
      Alert.alert(
        'GPS coordinates required',
        'Use current location or enter a valid latitude (-90 to 90) and longitude (-180 to 180).'
      );
      return;
    }

    setLoading(true);
    try {
      await submitCrimeReport({
        type,
        category: type,
        title: title.trim(),
        description: description.trim(),
        severity,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address.trim() || undefined,
          area: area.trim(),
          district: district.trim() || undefined,
          division: division.trim() || undefined,
        },
        reportedBy: user?.name?.trim() || user?.email || 'Community reporter',
        dateTime: new Date().toISOString(),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-crimes'] }),
        queryClient.invalidateQueries({ queryKey: ['map-crimes'] }),
        queryClient.invalidateQueries({ queryKey: ['heatmap'] }),
      ]);

      setTitle('');
      setDescription('');
      setType(CrimeType.THEFT);
      setSeverity(Severity.MEDIUM);
      setAddress('');
      setArea('');
      setDistrict('');
      setDivision('');
      setLocation(null);
      setTouched(false);

      Alert.alert('Report submitted', 'Your report was stored and will appear in analytics and live map data.', [
        { text: 'View map', onPress: () => router.push('/(tabs)/map' as never) },
        { text: 'Done', style: 'cancel' },
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Please try again.';
      Alert.alert('Submission failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="shield" size={26} color={COLORS.warning} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Report an Incident</Text>
          <Text style={styles.subtitle}>Accurate, timely reports help neighbors and responders stay informed.</Text>
        </View>
      </View>

      <View style={styles.notice}>
        <MaterialIcons name="info" size={20} color={COLORS.warning} />
        <Text style={styles.noticeText}>Reports are reviewed by moderators. False or abusive reports may lead to account restrictions.</Text>
      </View>

      <View style={styles.form}>
        <FieldLabel label="What happened?" invalid={touched && title.trim().length < TITLE_MIN} />
        <TextInput
          style={[styles.input, touched && title.trim().length < TITLE_MIN && styles.inputError]}
          placeholder="Short title"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <FieldLabel label="Description" invalid={touched && description.trim().length < DESC_MIN} />
        <TextInput
          style={[styles.input, styles.textarea, touched && description.trim().length < DESC_MIN && styles.inputError]}
          placeholder="Describe the time, what happened, and any details."
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Incident Type</Text>
        <View style={styles.pickerContainer}>
          {CRIME_TYPES.map((item) => (
            <Chip key={item} label={formatCrimeLabel(item)} active={type === item} onPress={() => setType(item)} />
          ))}
        </View>

        <Text style={styles.label}>Severity Level</Text>
        <View style={styles.pickerContainer}>
          {SEVERITIES.map((item) => (
            <Chip
              key={item}
              label={item}
              active={severity === item}
              onPress={() => setSeverity(item)}
              activeColor={item === 'CRITICAL' ? COLORS.danger : item === 'HIGH' ? COLORS.warning : item === 'LOW' ? COLORS.success : '#FBBF24'}
            />
          ))}
        </View>

        <FieldLabel label="Address or landmark" />
        <TextInput style={styles.input} placeholder="Road, landmark, or address" placeholderTextColor={COLORS.textMuted} value={address} onChangeText={setAddress} />

        <FieldLabel label="Area" invalid={touched && area.trim().length < AREA_MIN} />
        <TextInput
          style={[styles.input, touched && area.trim().length < AREA_MIN && styles.inputError]}
          placeholder="Neighborhood or area"
          placeholderTextColor={COLORS.textMuted}
          value={area}
          onChangeText={setArea}
        />

        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <FieldLabel label="District" />
            <TextInput style={styles.input} placeholder="District" placeholderTextColor={COLORS.textMuted} value={district} onChangeText={setDistrict} />
          </View>
          <View style={styles.column}>
            <FieldLabel label="Division" />
            <TextInput style={styles.input} placeholder="Division" placeholderTextColor={COLORS.textMuted} value={division} onChangeText={setDivision} />
          </View>
        </View>

        <View style={styles.locationActions}>
          <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation} disabled={locating}>
            <MaterialIcons name="my-location" size={20} color={COLORS.accent} />
            <Text style={styles.locationText}>{locating ? 'Reading GPS...' : 'Use current location'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.locationButton} onPress={findTypedLocation} disabled={locating}>
            <MaterialIcons name="travel-explore" size={20} color={COLORS.accent} />
            <Text style={styles.locationText}>Match typed place</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.coordCard}>
          <MaterialIcons name={location ? 'check-circle' : 'gps-not-fixed'} size={20} color={location ? COLORS.success : COLORS.textMuted} />
          <Text style={styles.coordText}>
            {location
              ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
              : 'No coordinates attached yet'}
          </Text>
        </View>

        <TouchableOpacity style={[styles.submitButton, loading && styles.submitDisabled]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit Report'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function FieldLabel({ label, invalid }: { label: string; invalid?: boolean }) {
  return <Text style={[styles.label, invalid && styles.labelError]}>{label}</Text>;
}

function Chip({ label, active, onPress, activeColor = COLORS.accent }: { label: string; active: boolean; onPress: () => void; activeColor?: string }) {
  return (
    <TouchableOpacity style={[styles.pill, active && { backgroundColor: activeColor, borderColor: activeColor }]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  headerIcon: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,149,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 4 },
  notice: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: 'rgba(255,149,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,149,0,0.22)', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  noticeText: { flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 19 },
  form: { gap: SPACING.sm },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800', marginTop: SPACING.sm, textTransform: 'uppercase' },
  labelError: { color: COLORS.danger },
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.sm, padding: 14, color: COLORS.text, fontSize: 15 },
  inputError: { borderColor: COLORS.danger },
  textarea: { minHeight: 118, textAlignVertical: 'top' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  pill: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder },
  pillText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: COLORS.bg },
  twoColumn: { flexDirection: 'row', gap: SPACING.sm },
  column: { flex: 1 },
  locationActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  locationButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm },
  locationText: { color: COLORS.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  coordCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.sm, padding: SPACING.md, marginTop: SPACING.sm },
  coordText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  submitButton: { backgroundColor: COLORS.accent, borderRadius: RADIUS.sm, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.md, ...SHADOWS.glow },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: COLORS.bg, fontSize: 15, fontWeight: '900' },
});
