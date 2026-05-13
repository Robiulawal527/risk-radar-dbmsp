import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Vibration, Linking, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  cancelAnimation 
} from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

export default function SosScreen() {
  const { user } = useAuthStore();
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [alertSent, setAlertSent] = useState(false);

  const { data: recentSOS } = useQuery({
    queryKey: ['sos-history'],
    queryFn: async () => {
      const response = await api.get('/sos/user');
      return response.data.data;
    },
  });

  // Pulsing animation for SOS button
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (sending && countdown > 0) {
      scale.value = withRepeat(
        withTiming(1.08, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      opacity.value = withRepeat(
        withTiming(0.7, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [sending, countdown]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const triggerSOS = () => {
    setSending(true);
    setCountdown(3);
    Vibration.vibrate([0, 200, 100, 200]);

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          sendEmergencyAlert();
          return 0;
        }
        Vibration.vibrate(300);
        return c - 1;
      });
    }, 1000);
  };

  const sendEmergencyAlert = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'SOS needs location access to notify responders.');
        setSending(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});

      await api.post('/sos', {
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: 'Live GPS Location',
          area: 'Current Location',
          district: 'Dhaka',
          division: 'Dhaka',
        },
        message: `🚨 EMERGENCY SOS triggered by ${user?.name || 'User'}`,
      });

      setAlertSent(true);
      Vibration.vibrate([0, 100, 50, 100, 50, 100]);
      
      setTimeout(() => {
        setSending(false);
        setAlertSent(false);
        Alert.alert(
          '🚨 ALERT SENT SUCCESSFULLY',
          'Your location has been shared with Bangladesh Police (999), nearby responders, and emergency contacts.',
          [{ text: 'OK', style: 'default' }]
        );
      }, 1800);
    } catch (error) {
      setSending(false);
      Alert.alert('Failed to Send', 'Please call 999 directly if this is a real emergency.');
    }
  };

  const cancelSOS = () => {
    setSending(false);
    setCountdown(0);
    Vibration.cancel();
  };

  const callEmergency = (number: string, name: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const emergencyContacts = [
    { name: 'Police Emergency', number: '999', icon: 'local-police' },
    { name: 'Fire Service', number: '102', icon: 'local-fire-department' },
    { name: 'Ambulance', number: '101', icon: 'local-hospital' },
    { name: 'Women & Children', number: '109', icon: 'people' },
  ];

  if (alertSent) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={92} color={COLORS.success} />
          <Text style={styles.successTitle}>ALERT SENT</Text>
          <Text style={styles.successSubtitle}>Help is on the way</Text>
          <Text style={styles.successDetail}>Responders notified • Location shared • Contacts alerted</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency SOS</Text>
        <Text style={styles.headerSubtitle}>One tap. Instant response. Stay safe.</Text>
      </View>

      <View style={styles.content}>
        {/* Big SOS Button */}
        <View style={styles.buttonWrapper}>
          <TouchableOpacity 
            onPress={sending ? cancelSOS : triggerSOS}
            activeOpacity={0.9}
            disabled={sending && countdown === 0}
          >
            <Animated.View style={[
              styles.sosButton, 
              pulseStyle,
              sending && styles.sosButtonActive
            ]}>
              <View style={styles.sosInner}>
                <MaterialIcons 
                  name={sending ? "hourglass-empty" : "emergency"} 
                  size={68} 
                  color="#fff" 
                />
                <Text style={styles.sosText}>
                  {sending && countdown > 0 ? countdown : 'SOS'}
                </Text>
                <Text style={styles.sosSubtext}>
                  {sending && countdown > 0 ? 'HOLD TO CANCEL' : 'TAP TO ACTIVATE'}
                </Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <Text style={styles.instruction}>
          {sending ? 'Sending alert to emergency services...' : 'Press and hold for 3 seconds in real emergency'}
        </Text>

        {/* Emergency Contacts */}
        <View style={styles.contactsSection}>
          <Text style={styles.sectionTitle}>Quick Call</Text>
          <View style={styles.contactsGrid}>
            {emergencyContacts.map((contact, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.contactCard}
                onPress={() => callEmergency(contact.number, contact.name)}
              >
                <View style={styles.contactIcon}>
                  <MaterialIcons name={contact.icon as any} size={22} color={COLORS.accent} />
                </View>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactNumber}>{contact.number}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        {recentSOS && recentSOS.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent SOS Activity</Text>
            {recentSOS.slice(0, 2).map((sos: any, index: number) => (
              <View key={index} style={styles.recentCard}>
                <View style={styles.recentLeft}>
                  <MaterialIcons name="history" size={18} color={COLORS.textMuted} />
                  <Text style={styles.recentText}>
                    {new Date(sos.createdAt).toLocaleDateString()} • {sos.location?.area || 'Unknown'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { 
                  backgroundColor: sos.status === 'RESOLVED' ? 'rgba(0, 200, 83, 0.15)' : 'rgba(255, 46, 99, 0.15)' 
                }]}>
                  <Text style={[styles.statusText, { 
                    color: sos.status === 'RESOLVED' ? COLORS.success : COLORS.danger 
                  }]}>{sos.status}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Your location will be shared with Bangladesh Police and verified community responders.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  buttonWrapper: {
    marginVertical: SPACING.xl,
  },
  sosButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.glow,
    shadowColor: COLORS.danger,
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  sosButtonActive: {
    backgroundColor: '#B91C1C',
  },
  sosInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    marginTop: 8,
    letterSpacing: -1,
  },
  sosSubtext: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  instruction: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: 40,
  },
  contactsSection: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  contactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  contactCard: {
    width: (Dimensions.get('window').width - SPACING.lg * 2 - SPACING.md) / 2,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  contactName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  contactNumber: {
    ...TYPOGRAPHY.h3,
    color: COLORS.accent,
    fontWeight: '800',
    marginTop: 2,
  },
  recentSection: {
    width: '100%',
  },
  recentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recentText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  footerText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  successContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  successTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.success,
    marginTop: SPACING.lg,
    letterSpacing: -1,
  },
  successSubtitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  successDetail: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
