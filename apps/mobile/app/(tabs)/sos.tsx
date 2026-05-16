import React, { useMemo, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { SOSStatus, type SOSRequest } from '@risk-radar/types';
import { api } from '@/lib/api';
import { createSosAlertInSupabase, fetchMySosAlertsFromSupabase, resolveSosAlertInSupabase } from '@/lib/sos-alerts';
import { isSupabaseConfigured } from '@/lib/supabase';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../constants/theme';

const LOCAL_SOS_KEY = 'risk-radar:pending-sos-requests';
const CREATE_SOS_ENDPOINTS = ['/sos', '/sos/'] as const;
const GET_MY_SOS_ENDPOINTS = ['/sos/user', '/sos/my', '/sos/me'] as const;

type Coordinates = { latitude: number; longitude: number; accuracy?: number | null };
type LocalSOSRequest = SOSRequest & {
  isLocalOnly?: boolean;
  syncError?: string;
  updatedAt?: string | Date;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
};

/** Tries compatible backend routes in order so deployed and local APIs with small route differences still work. */
async function requestWithFallback<T>(endpoints: readonly string[], request: (endpoint: string) => Promise<T>) {
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      return await request(endpoint);
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status && ![404, 405, 503].includes(status)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed.');
}

/** Normalizes list responses from Express, Next proxy, or direct arrays into a SOSRequest array. */
function normalizeRequests(payload: ApiResponse<SOSRequest[]> | SOSRequest[]) {
  if (Array.isArray(payload)) return payload;
  if (payload.success === false) {
    throw new Error(payload.message || payload.error || 'Could not load SOS requests.');
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

/** Normalizes one SOS mutation response regardless of whether the API wraps it in { success, data }. */
function normalizeRequest(payload: ApiResponse<SOSRequest> | SOSRequest) {
  if ('success' in payload && payload.success === false) {
    throw new Error(payload.message || payload.error || 'Could not update SOS request.');
  }
  if ('data' in payload && payload.data) return payload.data;
  return payload as SOSRequest;
}

/** Extracts a user-safe error message from Axios and normal Error objects. */
function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeAxiosError = error as {
      response?: { status?: number; data?: { message?: string; error?: string } };
      message?: string;
    };
    const apiMessage = maybeAxiosError.response?.data?.message || maybeAxiosError.response?.data?.error;
    if (maybeAxiosError.response?.status === 503) {
      return 'SOS server is temporarily unavailable. Your request was saved locally.';
    }
    if (apiMessage) return apiMessage;
    if (maybeAxiosError.response?.status) return `Request failed with status code ${maybeAxiosError.response.status}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Formats coordinates consistently for both remote payloads and pending local SOS cards. */
function formatCoordinates({ latitude, longitude }: Coordinates) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Builds the backend create payload from the current GPS fix. */
function buildSOSPayload(coordinates: Coordinates) {
  return {
    location: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: coordinates.accuracy,
      area: 'GPS fix',
      address: formatCoordinates(coordinates),
    },
    message: 'Emergency assistance requested',
  };
}

/** Creates a local pending SOS when network/Supabase writes fail, preserving the user's emergency intent. */
function buildLocalRequest(coordinates: Coordinates, syncError: string): LocalSOSRequest {
  const createdAt = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    userId: 'local',
    status: SOSStatus.ACTIVE,
    location: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: coordinates.accuracy,
      area: 'Pending GPS fix',
      address: formatCoordinates(coordinates),
    },
    message: 'Emergency assistance requested',
    createdAt: new Date(createdAt),
    updatedAt: createdAt,
    isLocalOnly: true,
    syncError,
  };
}

/** Reads pending SOS entries from AsyncStorage and safely ignores corrupt local JSON. */
async function readLocalSOSRequests(): Promise<LocalSOSRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_SOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Saves a local pending SOS without duplicating an existing local id. */
async function saveLocalSOSRequest(request: LocalSOSRequest) {
  const existing = await readLocalSOSRequests();
  const next = [request, ...existing.filter((item) => item.id !== request.id)];
  await AsyncStorage.setItem(LOCAL_SOS_KEY, JSON.stringify(next));
}

/** Removes a local-only SOS after the user deletes it or after a successful server sync. */
async function removeLocalSOSRequest(id: string) {
  const existing = await readLocalSOSRequests();
  await AsyncStorage.setItem(LOCAL_SOS_KEY, JSON.stringify(existing.filter((item) => item.id !== id)));
}

/** Formats SOS timestamps for compact mobile history cards. */
function formatDateTime(value?: string | Date | null) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

export default function SosScreen() {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [localRequests, setLocalRequests] = useState<LocalSOSRequest[]>([]);

  const {
    data: remoteRequests = [],
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['sos-my'],
    queryFn: async () => {
      const [remote, local] = await Promise.all([
        isSupabaseConfigured()
          ? fetchMySosAlertsFromSupabase().catch(() =>
              requestWithFallback(GET_MY_SOS_ENDPOINTS, async (endpoint) => {
                const response = await api.get<ApiResponse<SOSRequest[]> | SOSRequest[]>(endpoint);
                return normalizeRequests(response.data);
              })
            )
          : requestWithFallback(GET_MY_SOS_ENDPOINTS, async (endpoint) => {
              const response = await api.get<ApiResponse<SOSRequest[]> | SOSRequest[]>(endpoint);
              return normalizeRequests(response.data);
            }),
        readLocalSOSRequests(),
      ]);
      setLocalRequests(local);
      return remote;
    },
    staleTime: 30_000,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });

  const requests = useMemo(() => {
    const remoteAsLocal = remoteRequests as LocalSOSRequest[];
    const remoteIds = new Set(remoteAsLocal.map((request) => request.id));
    const pendingLocal = localRequests.filter((request) => !remoteIds.has(request.id));
    return [...pendingLocal, ...remoteAsLocal].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [localRequests, remoteRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    const local = await readLocalSOSRequests();
    setLocalRequests(local);
    await refetch();
    setRefreshing(false);
  };

  /** Requests foreground GPS permission and returns one high-accuracy coordinate fix for SOS creation. */
  const readCoordinates = async (): Promise<Coordinates> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission was denied. Allow location access and try again.');
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: Number.isFinite(location.coords.accuracy ?? NaN) ? location.coords.accuracy : null,
    };
  };

  /** Creates an SOS via Supabase first, API second, and local pending storage as the final fallback. */
  const sendEmergencyAlert = async () => {
    setSending(true);
    Vibration.vibrate([0, 180, 80, 180]);
    try {
      const coordinates = await readCoordinates();
      try {
        let directError: unknown;
        const direct = await createSosAlertInSupabase({
          coordinates,
          message: 'Emergency assistance requested',
        }).catch((error) => {
          directError = error;
          return null;
        });

        if (!direct) {
          try {
            await requestWithFallback(CREATE_SOS_ENDPOINTS, async (endpoint) => {
              const response = await api.post<ApiResponse<SOSRequest>>(endpoint, buildSOSPayload(coordinates));
              if (response.data.success === false) {
                throw new Error(response.data.message || response.data.error || 'Could not create SOS request.');
              }
              return response.data;
            });
          } catch (apiError) {
            throw directError instanceof Error ? directError : apiError;
          }
        }
        await queryClient.invalidateQueries({ queryKey: ['sos-my'] });
        await queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] });
        Alert.alert('Alert sent', 'Your GPS location was shared with emergency responders.');
      } catch (error) {
        const message = getErrorMessage(error);
        const local = buildLocalRequest(coordinates, message);
        await saveLocalSOSRequest(local);
        setLocalRequests(await readLocalSOSRequests());
        Alert.alert('Saved as pending SOS', `${message}\n\nCall 999 directly if this is an immediate emergency.`);
      }
    } catch (error) {
      Alert.alert('SOS blocked', error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setSending(false);
    }
  };

  /** Confirms the emergency action before vibrating and sending the SOS. */
  const confirmSOS = () => {
    Alert.alert('Send emergency SOS?', 'This shares your GPS location. Use it only for real emergencies.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: () => void sendEmergencyAlert() },
    ]);
  };

  /** Opens the native phone dialer for official emergency numbers. */
  const callEmergency = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => Alert.alert('Call failed', `Dial ${number} manually.`));
  };

  /** Resolves or removes a SOS card, covering synced rows, API-only deployments, and local pending records. */
  const resolveSos = async (sos: LocalSOSRequest) => {
    if (resolvingId) return;

    const isLocalOnly = sos.isLocalOnly || sos.id.startsWith('local-');
    Alert.alert(
      isLocalOnly ? 'Delete pending SOS?' : 'Delete active SOS?',
      isLocalOnly
        ? 'This removes the locally saved pending SOS from this phone.'
        : 'This marks the SOS as resolved so it disappears from live maps and nearby alerts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setResolvingId(sos.id);
            try {
              if (isLocalOnly) {
                await removeLocalSOSRequest(sos.id);
              } else {
                let directError: unknown;
                const direct = await resolveSosAlertInSupabase(sos.id).catch((error) => {
                  directError = error;
                  return null;
                });
                if (!direct) {
                  const encodedId = encodeURIComponent(sos.id);
                  try {
                    await requestWithFallback(
                      [`/sos/${encodedId}/status`, `/sos/${encodedId}`],
                      async (endpoint) => {
                        const response = endpoint.endsWith('/status')
                          ? await api.put<ApiResponse<SOSRequest> | SOSRequest>(endpoint, { status: SOSStatus.RESOLVED })
                          : await api.delete<ApiResponse<SOSRequest> | SOSRequest>(endpoint);
                        return normalizeRequest(response.data);
                      }
                    );
                  } catch (apiError) {
                    throw directError instanceof Error ? directError : apiError;
                  }
                }
              }

              setLocalRequests(await readLocalSOSRequests());
              await queryClient.invalidateQueries({ queryKey: ['sos-my'] });
              await queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] });
              Alert.alert('SOS removed', 'This SOS will no longer show as active.');
            } catch (error) {
              Alert.alert('Could not remove SOS', getErrorMessage(error));
            } finally {
              setResolvingId(null);
            }
          },
        },
      ]
    );
  };

  const emergencyContacts = [
    { name: 'Police Emergency', number: '999', icon: 'local-police' },
    { name: 'Fire Service', number: '102', icon: 'local-fire-department' },
    { name: 'Ambulance', number: '101', icon: 'local-hospital' },
    { name: 'Women & Children', number: '109', icon: 'people' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing || isFetching} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency SOS</Text>
        <Text style={styles.headerSubtitle}>Share your location fast, or call national emergency services directly.</Text>
      </View>

      {isError ? <Text style={styles.warning}>SOS history could not be loaded. Local pending requests are still shown.</Text> : null}

      <TouchableOpacity style={[styles.sosButton, sending && styles.sosButtonBusy]} onPress={confirmSOS} disabled={sending}>
        <MaterialIcons name={sending ? 'hourglass-empty' : 'emergency'} size={64} color="#fff" />
        <Text style={styles.sosText}>{sending ? 'SENDING' : 'SOS'}</Text>
        <Text style={styles.sosSubtext}>{sending ? 'Reading GPS and notifying' : 'Tap to activate'}</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Call</Text>
        <View style={styles.contactsGrid}>
          {emergencyContacts.map((contact) => (
            <TouchableOpacity key={contact.number} style={styles.contactCard} onPress={() => callEmergency(contact.number)}>
              <View style={styles.contactIcon}>
                <MaterialIcons name={contact.icon as any} size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactNumber}>{contact.number}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SOS Activity</Text>
        {requests.length === 0 ? (
          <Text style={styles.emptyText}>No SOS requests yet.</Text>
        ) : (
          requests.slice(0, 8).map((sos) => {
            const canDelete = sos.status === SOSStatus.ACTIVE || Boolean(sos.isLocalOnly);

            return (
              <View key={sos.id} style={styles.recentCard}>
                <View style={styles.recentTop}>
                  <View style={styles.recentLeft}>
                    <MaterialIcons name={sos.isLocalOnly ? 'wifi-off' : 'history'} size={18} color={sos.isLocalOnly ? COLORS.warning : COLORS.textMuted} />
                    <Text style={styles.recentText}>{formatDateTime(sos.createdAt)}</Text>
                  </View>
                  <View style={styles.recentActions}>
                    <View style={[styles.statusBadge, sos.status === SOSStatus.RESOLVED ? styles.statusResolved : styles.statusActive]}>
                      <Text style={[styles.statusText, sos.status === SOSStatus.RESOLVED ? styles.statusTextResolved : styles.statusTextActive]}>
                        {sos.isLocalOnly ? 'PENDING' : sos.status}
                      </Text>
                    </View>
                    {canDelete ? (
                      <TouchableOpacity
                        style={[styles.deleteButton, resolvingId === sos.id && styles.deleteButtonDisabled]}
                        onPress={() => void resolveSos(sos)}
                        disabled={resolvingId === sos.id}
                      >
                        <MaterialIcons name={resolvingId === sos.id ? 'hourglass-empty' : 'delete-outline'} size={15} color="#fff" />
                        <Text style={styles.deleteButtonText}>{resolvingId === sos.id ? 'Deleting' : 'Delete'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.locationText}>{sos.location?.address || formatCoordinates(sos.location)}</Text>
                {sos.syncError ? <Text style={styles.syncError}>{sos.syncError}</Text> : null}
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.footerText}>Your location is shared only when you confirm an SOS request.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 120 },
  header: { marginBottom: SPACING.lg },
  headerTitle: { ...TYPOGRAPHY.h1, color: COLORS.text },
  headerSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 6 },
  warning: { color: COLORS.warning, marginBottom: SPACING.md },
  sosButton: {
    height: 230,
    borderRadius: 115,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 230,
    marginVertical: SPACING.lg,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 15,
  },
  sosButtonBusy: { opacity: 0.72 },
  sosText: { color: '#fff', fontSize: 42, fontWeight: '900', marginTop: SPACING.xs },
  sosSubtext: { color: 'rgba(255,255,255,0.84)', fontSize: 11, fontWeight: '800', marginTop: 4 },
  section: { marginTop: SPACING.lg },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: SPACING.md },
  contactsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  contactCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  contactIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,229,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  contactName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  contactNumber: { color: COLORS.accent, fontSize: 18, fontWeight: '900', marginTop: 3 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.lg },
  recentCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  recentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  recentText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  recentActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.full },
  statusActive: { backgroundColor: 'rgba(255,46,99,0.15)' },
  statusResolved: { backgroundColor: 'rgba(0,200,83,0.15)' },
  statusText: { fontSize: 10, fontWeight: '900' },
  statusTextActive: { color: COLORS.danger },
  statusTextResolved: { color: COLORS.success },
  deleteButton: { minHeight: 30, borderRadius: RADIUS.full, paddingHorizontal: 10, backgroundColor: COLORS.danger, flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteButtonDisabled: { opacity: 0.58 },
  deleteButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  locationText: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.sm },
  syncError: { color: COLORS.warning, fontSize: 11, marginTop: 4 },
  footerText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xl, fontSize: 12 },
});
