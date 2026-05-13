import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { MaterialIcons } from '@expo/vector-icons';

const crimeTypes = [
  'THEFT', 'ROBBERY', 'ASSAULT', 'BURGLARY', 
  'FRAUD', 'VANDALISM', 'HARASSMENT', 'OTHER'
];

const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function ReportScreen() {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('THEFT');
  const [severity, setSeverity] = useState('MEDIUM');
  const [location, setLocation] = useState<{ latitude: number; longitude: number; area: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please enable location access to report incidents.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;

      // Simple area detection (in production use reverse geocoding)
      let area = 'Unknown Area';
      if (latitude > 23.75 && latitude < 23.85 && longitude > 90.35 && longitude < 90.45) {
        area = 'Dhanmondi';
      } else if (latitude > 23.78 && latitude < 23.82 && longitude > 90.40 && longitude < 90.44) {
        area = 'Gulshan';
      } else if (latitude > 23.79 && latitude < 23.83 && longitude > 90.36 && longitude < 90.40) {
        area = 'Mirpur';
      }

      setLocation({ latitude, longitude, area });
      Alert.alert('Location captured', `Incident location set to ${area}`);
    } catch (error) {
      Alert.alert('Error', 'Could not get your location.');
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !location) {
      Alert.alert('Missing Information', 'Please fill all fields and capture location.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/crimes', {
        type,
        category: type,
        title,
        description,
        severity,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          area: location.area,
          district: 'Dhaka',
          division: 'Dhaka',
        },
        reportedBy: user?.name || 'Anonymous',
      });

      Alert.alert(
        'Report Submitted', 
        'Thank you. Your report has been added to the live map and will help keep the community safe.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Submission Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Report Incident</Text>
      <Text style={styles.subtitle}>Help keep Dhaka safe. All reports are verified.</Text>

      <View style={styles.form}>
        <Text style={styles.label}>What happened?</Text>
        <TextInput
          style={styles.input}
          placeholder="Short title (e.g. Phone snatching near bus stop)"
          placeholderTextColor="#64748b"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Describe what you saw, time, any details..."
          placeholderTextColor="#64748b"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Incident Type</Text>
        <View style={styles.pickerContainer}>
          {crimeTypes.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.pill, type === t && styles.pillActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Severity Level</Text>
        <View style={styles.pickerContainer}>
          {severities.map((s, idx) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.pill, 
                severity === s && styles.pillActive,
                { borderColor: ['#22c55e', '#eab308', '#f59e0b', '#ef4444'][idx] }
              ]}
              onPress={() => setSeverity(s)}
            >
              <Text style={[styles.pillText, severity === s && styles.pillTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <TouchableOpacity 
          style={styles.locationButton} 
          onPress={getCurrentLocation}
        >
          <MaterialIcons name="my-location" size={20} color="#22d3ee" />
          <Text style={styles.locationText}>
            {location ? `${location.area} • Captured` : 'Tap to capture current location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? 'Submitting Report...' : 'Submit Report to Community'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          False reports may result in account suspension. Thank you for helping keep our community safe.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 8,
    marginBottom: 28,
  },
  form: {
    gap: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  pillActive: {
    backgroundColor: '#22d3ee',
    borderColor: '#22d3ee',
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#020617',
    fontWeight: '700',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 10,
  },
  locationText: {
    color: '#22d3ee',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});
