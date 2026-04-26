import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { analyticsApi, areaApi, authApi, crimeApi, emergencyApi, profileApi } from './src/api';
import { fallbackAreas, fallbackCrimes, fallbackCrimeTypes } from './src/data/bangladeshCrimeStats';
import { t } from './src/i18n';
import { findNearestHotspot, getAreaRiskScore, getRiskColor } from './src/risk';
import { Area, Crime, CrimeType, Language, User } from './src/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

type Tab = 'map' | 'report' | 'analytics' | 'profile' | 'admin';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>('map');
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [types, setTypes] = useState<CrimeType[]>([]);
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [selectedCrime, setSelectedCrime] = useState<Crime | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [predictions, setPredictions] = useState<Array<Record<string, unknown>>>([]);
  const [ranking, setRanking] = useState<Array<Record<string, unknown>>>([]);
  const [filterType, setFilterType] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const [crimeResponse, areaResponse, typeResponse] = await Promise.all([
        crimeApi.crimes(),
        areaApi.all(),
        crimeApi.types()
      ]);
      setCrimes(crimeResponse.data.length ? crimeResponse.data : fallbackCrimes);
      setAreas(areaResponse.data.length ? areaResponse.data : fallbackAreas);
      setTypes(typeResponse.data.length ? typeResponse.data : fallbackCrimeTypes);
    } catch {
      setCrimes(fallbackCrimes);
      setAreas(fallbackAreas);
      setTypes(fallbackCrimeTypes);
    }
  }, []);

  useEffect(() => {
    authApi.hydrate().then(setUser).finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [loadData, user]);

  useEffect(() => {
    if (!user) return;
    let subscription: Location.LocationSubscription | null = null;

    const startLocation = async () => {
      const foreground = await Location.requestForegroundPermissionsAsync();
      await Notifications.requestPermissionsAsync();
      if (foreground.status !== 'granted') return;

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(current.coords);

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 150 },
        async ({ coords }) => {
          setLocation(coords);
          const hotspot = findNearestHotspot(coords.latitude, coords.longitude, areas, crimes);
          if (hotspot) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: t(language, 'alertTitle'),
                body: `${t(language, 'alertBody')} ${hotspot.area.name_en}: ${hotspot.riskScore}/100`
              },
              trigger: null
            });
          }
        }
      );
    };

    startLocation();
    return () => subscription?.remove();
  }, [areas, crimes, language, user]);

  const filteredCrimes = useMemo(() => {
    if (filterType === 'all') return crimes;
    return crimes.filter((crime) => crime.crime_type_id === filterType);
  }, [crimes, filterType]);

  const currentRisk = useMemo(() => {
    if (!location) return null;
    return findNearestHotspot(location.latitude, location.longitude, areas, crimes);
  }, [areas, crimes, location]);

  if (booting) {
    return <Splash />;
  }

  if (!user) {
    return <AuthScreen language={language} setLanguage={setLanguage} onLogin={setUser} />;
  }

  const tabs: Tab[] = user.role === 'admin' || user.role === 'police'
    ? ['map', 'report', 'analytics', 'admin', 'profile']
    : ['map', 'report', 'analytics', 'profile'];

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>{t(language, 'appName')}</Text>
          <Text style={styles.tagline}>{t(language, 'tagline')}</Text>
        </View>
        <Pressable style={styles.languageButton} onPress={() => setLanguage(language === 'en' ? 'bn' : 'en')}>
          <Text style={styles.languageText}>{language === 'en' ? 'BN' : 'EN'}</Text>
        </Pressable>
      </View>

      {tab === 'map' && (
        <MapScreen
          crimes={filteredCrimes}
          allCrimes={crimes}
          areas={areas}
          types={types}
          filterType={filterType}
          setFilterType={setFilterType}
          location={location}
          selectedCrime={selectedCrime}
          setSelectedCrime={setSelectedCrime}
          currentRisk={currentRisk}
          language={language}
          onSos={async (type) => {
            if (!location) return Alert.alert('Risk Radar', 'Location is not available yet.');
            try {
              await emergencyApi.sos(location.latitude, location.longitude, type, type === 'sos' ? 'Emergency SOS' : 'User feels unsafe');
              Alert.alert('Risk Radar', 'Emergency alert sent.');
            } catch {
              Alert.alert('Risk Radar', 'Emergency action captured locally. Call 999 immediately if you are in danger.');
            }
          }}
        />
      )}
      {tab === 'report' && (
        <ReportScreen
          language={language}
          types={types}
          location={location}
          onCreated={loadData}
          onLocalCrime={(crime) => setCrimes((current) => [crime, ...current])}
        />
      )}
      {tab === 'analytics' && (
        <AnalyticsScreen
          language={language}
          stats={stats}
          predictions={predictions}
          load={async () => {
            try {
              const [statsResponse, predictionResponse] = await Promise.all([analyticsApi.stats(), analyticsApi.predictions()]);
              setStats(statsResponse.data);
              setPredictions(predictionResponse.data);
            } catch {
              const totalCases = crimes.reduce((sum, crime) => sum + (crime.caseCount || 1), 0);
              setStats({
                overview: {
                  total_crimes: totalCases,
                  last_7_days: crimes.length,
                  today: 0,
                  avg_severity: crimes.length ? (crimes.reduce((sum, crime) => sum + crime.severity, 0) / crimes.length).toFixed(1) : 0
                }
              });
              setPredictions(
                [...areas]
                  .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
                  .slice(0, 6)
                  .map((area) => ({
                    name_en: area.name_en,
                    predicted_risk: Number(area.risk_score || 0),
                    confidence: 86
                  }))
              );
            }
          }}
        />
      )}
      {tab === 'admin' && (
        <AdminScreen
          language={language}
          ranking={ranking}
          load={async () => {
            const response = await profileApi.criminalRanking();
            setRanking(response.data);
          }}
        />
      )}
      {tab === 'profile' && (
        <ProfileScreen
          language={language}
          user={user}
          onLogout={async () => {
            await authApi.logout();
            setUser(null);
          }}
        />
      )}

      <View style={styles.tabBar}>
        {tabs.map((item) => (
          <Pressable key={item} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{t(language, item)}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Splash() {
  return (
    <SafeAreaView style={[styles.shell, styles.center]}>
      <ActivityIndicator color="#dc2626" size="large" />
      <Text style={styles.brand}>Risk Radar</Text>
    </SafeAreaView>
  );
}

function AuthScreen({ language, setLanguage, onLogin }: { language: Language; setLanguage: (value: Language) => void; onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('user@riskradar.bd');
  const [password, setPassword] = useState('user123');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      const nextUser = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.signup(fullName, email, password);
      onLogin(nextUser);
    } catch (error) {
      const offlineUser: User = {
        id: 'offline-demo-user',
        email,
        fullName: fullName || 'Risk Radar Demo User',
        role: email.toLowerCase().includes('admin') ? 'admin' : 'user'
      };
      Alert.alert('Risk Radar', 'API unavailable, continuing in offline demo mode with CSV data.');
      onLogin(offlineUser);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authShell}>
      <View style={styles.authHeader}>
        <Text style={styles.authTitle}>{t(language, 'appName')}</Text>
        <Text style={styles.authTagline}>{t(language, 'tagline')}</Text>
      </View>
      <View style={styles.panel}>
        <View style={styles.segment}>
          {(['login', 'signup'] as const).map((item) => (
            <Pressable key={item} style={[styles.segmentItem, mode === item && styles.segmentActive]} onPress={() => setMode(item)}>
              <Text style={[styles.segmentText, mode === item && styles.segmentActiveText]}>{t(language, item)}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'signup' && <Field label={t(language, 'fullName')} value={fullName} onChangeText={setFullName} />}
        <Field label={t(language, 'email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label={t(language, 'password')} value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable style={styles.primaryButton} onPress={submit} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? '...' : t(language, mode)}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setLanguage(language === 'en' ? 'bn' : 'en')}>
          <Text style={styles.secondaryButtonText}>{language === 'en' ? 'বাংলা' : 'English'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function MapScreen(props: {
  crimes: Crime[];
  allCrimes: Crime[];
  areas: Area[];
  types: CrimeType[];
  filterType: string;
  setFilterType: (value: string) => void;
  location: Location.LocationObjectCoords | null;
  selectedCrime: Crime | null;
  setSelectedCrime: (crime: Crime | null) => void;
  currentRisk: { area: Area; riskScore: number; distanceKm: number } | undefined | null;
  language: Language;
  onSos: (type: 'sos' | 'unsafe') => void;
}) {
  const mapRef = useRef<MapView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<Area | null>(null);
  const [searchMessage, setSearchMessage] = useState('');
  const center = props.location || { latitude: 23.8103, longitude: 90.4125, latitudeDelta: 0.2, longitudeDelta: 0.2 };

  const searchLocation = async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    let target = props.areas.find((area) => (
      area.name_en.toLowerCase().includes(query) ||
      area.name_bn.toLowerCase().includes(query) ||
      area.district.toLowerCase().includes(query) ||
      area.division.toLowerCase().includes(query)
    ));

    if (!target) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&q=${encodeURIComponent(searchQuery)}`);
        const [place] = await response.json();
        if (place?.lat && place?.lon) {
          target = {
            id: `search-${Date.now()}`,
            name_en: place.display_name.split(',')[0],
            name_bn: place.display_name.split(',')[0],
            district: 'Bangladesh',
            division: 'Bangladesh',
            latitude: Number(place.lat),
            longitude: Number(place.lon),
            risk_score: 0,
            crime_count: 0
          };
        }
      } catch {
        target = undefined;
      }
    }

    if (!target) {
      setSearchTarget(null);
      setSearchMessage(props.language === 'en' ? 'No match. Try Dhaka, Chattogram, Rajshahi, Rangpur, Sylhet, Gazipur, Railway, or another Bangladesh place.' : 'ম্যাচ নেই। ঢাকা, চট্টগ্রাম, রাজশাহী, রংপুর, সিলেট, গাজীপুর, রেলওয়ে বা বাংলাদেশের অন্য জায়গা লিখুন।');
      return;
    }

    setSearchTarget(target);
    setSearchMessage(`${props.language === 'en' ? target.name_en : target.name_bn} • ${target.district}`);
    mapRef.current?.animateToRegion({
      latitude: Number(target.latitude),
      longitude: Number(target.longitude),
      latitudeDelta: target.name_en.includes('Range') ? 1.4 : 0.22,
      longitudeDelta: target.name_en.includes('Range') ? 1.4 : 0.22
    }, 650);
  };

  return (
    <View style={styles.content}>
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={props.language === 'en' ? 'Search location or range' : 'লোকেশন বা রেঞ্জ খুঁজুন'}
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={searchLocation}
        />
        <Pressable style={styles.searchButton} onPress={searchLocation}>
          <Text style={styles.searchButtonText}>{props.language === 'en' ? 'Search' : 'খুঁজুন'}</Text>
        </Pressable>
      </View>
      {!!searchMessage && <Text style={styles.searchMessage}>{searchMessage}</Text>}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.18,
            longitudeDelta: 0.18
          }}
          showsUserLocation
        >
          {props.areas.map((area) => {
            const score = getAreaRiskScore(area, props.allCrimes);
            return (
              <Circle
                key={area.id}
                center={{ latitude: Number(area.latitude), longitude: Number(area.longitude) }}
                radius={350 + score * 16}
                fillColor={`${getRiskColor(score)}44`}
                strokeColor={getRiskColor(score)}
                strokeWidth={1}
              />
            );
          })}
          {searchTarget && (
            <>
              <Circle
                center={{ latitude: Number(searchTarget.latitude), longitude: Number(searchTarget.longitude) }}
                radius={searchTarget.name_en.includes('Range') ? 45000 : 12000}
                fillColor="#dc262622"
                strokeColor="#dc2626"
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: Number(searchTarget.latitude), longitude: Number(searchTarget.longitude) }}
                pinColor="#dc2626"
                title={props.language === 'en' ? searchTarget.name_en : searchTarget.name_bn}
                description={`${searchTarget.district} • Risk ${Math.round(Number(searchTarget.risk_score || 0))}/100`}
              />
            </>
          )}
          {props.crimes.map((crime) => (
            <Marker
              key={crime.id}
              coordinate={{ latitude: Number(crime.latitude), longitude: Number(crime.longitude) }}
              pinColor={crime.color || getRiskColor(crime.severity * 18)}
              onPress={() => props.setSelectedCrime(crime)}
              title={crime.title}
              description={crime.area}
            />
          ))}
        </MapView>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRail}>
        <Chip label="All" active={props.filterType === 'all'} onPress={() => props.setFilterType('all')} />
        {props.types.map((type) => (
          <Chip key={type.id} label={props.language === 'en' ? type.name_en : type.name_bn} active={props.filterType === type.id} onPress={() => props.setFilterType(type.id)} />
        ))}
      </ScrollView>
      <View style={styles.actionRow}>
        <Pressable style={styles.dangerButton} onPress={() => props.onSos('sos')}>
          <Text style={styles.dangerButtonText}>{t(props.language, 'sos')}</Text>
        </Pressable>
        <Pressable style={styles.warnButton} onPress={() => props.onSos('unsafe')}>
          <Text style={styles.warnButtonText}>{t(props.language, 'unsafe')}</Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t(props.language, 'riskNearMe')}</Text>
        <Text style={styles.metricText}>
          {props.currentRisk ? `${props.currentRisk.area.name_en}: ${props.currentRisk.riskScore}/100` : 'No high-risk hotspot within 2.5 km'}
        </Text>
        {props.selectedCrime && (
          <View style={styles.detailBox}>
            <Text style={styles.detailTitle}>{props.selectedCrime.title}</Text>
            <Text style={styles.bodyText}>{props.selectedCrime.type_name} • {props.selectedCrime.caseCount || 1} cases • Severity {props.selectedCrime.severity} • {props.selectedCrime.area}</Text>
            <Text style={styles.bodyText}>{props.selectedCrime.description}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ReportScreen({ language, types, location, onCreated, onLocalCrime }: { language: Language; types: CrimeType[]; location: Location.LocationObjectCoords | null; onCreated: () => Promise<void>; onLocalCrime: (crime: Crime) => void }) {
  const [crimeTypeId, setCrimeTypeId] = useState(types[0]?.id || 'theft');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('3');

  useEffect(() => {
    if (types[0] && !crimeTypeId) setCrimeTypeId(types[0].id);
  }, [crimeTypeId, types]);

  const submit = async () => {
    if (!location) return Alert.alert('Risk Radar', 'Location is required to submit a report.');
    const selectedType = types.find((type) => type.id === crimeTypeId) || types[0];
    const payload = {
      crimeTypeId,
      title,
      description,
      latitude: location.latitude,
      longitude: location.longitude,
      incidentDate: new Date().toISOString(),
      severity: Number(severity)
    };

    let savedLocally = false;
    try {
      await crimeApi.create(payload);
    } catch {
      savedLocally = true;
      onLocalCrime({
        id: `local-${Date.now()}`,
        crime_type_id: crimeTypeId,
        type_name: selectedType?.name_en || crimeTypeId,
        type_name_bn: selectedType?.name_bn || crimeTypeId,
        title,
        description,
        latitude: location.latitude,
        longitude: location.longitude,
        incident_date: new Date().toISOString(),
        severity: Number(severity),
        status: 'local',
        area: 'Current location',
        area_bn: 'বর্তমান লোকেশন',
        color: selectedType?.color || '#dc2626',
        caseCount: 1
      });
    }

    setTitle('');
    setDescription('');
    if (!savedLocally) await onCreated();
    Alert.alert('Risk Radar', savedLocally ? 'Report saved locally.' : 'Report submitted.');
  };

  return (
    <ScrollView style={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t(language, 'submitReport')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRail}>
          {types.map((type) => (
            <Chip key={type.id} label={language === 'en' ? type.name_en : type.name_bn} active={crimeTypeId === type.id} onPress={() => setCrimeTypeId(type.id)} />
          ))}
        </ScrollView>
        <Field label={t(language, 'title')} value={title} onChangeText={setTitle} />
        <Field label={t(language, 'description')} value={description} onChangeText={setDescription} multiline />
        <Field label={t(language, 'severity')} value={severity} onChangeText={setSeverity} keyboardType="number-pad" />
        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>{t(language, 'submitReport')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AnalyticsScreen({ language, stats, predictions, load }: { language: Language; stats: Record<string, unknown> | null; predictions: Array<Record<string, unknown>>; load: () => Promise<void> }) {
  useEffect(() => {
    load().catch((error) => Alert.alert('Risk Radar', error.message));
  }, []);

  const overview = (stats?.overview || {}) as Record<string, string | number>;
  return (
    <ScrollView style={styles.content}>
      <View style={styles.grid}>
        <Metric label="Total" value={overview.total_crimes || 0} />
        <Metric label="7 days" value={overview.last_7_days || 0} />
        <Metric label="Today" value={overview.today || 0} />
        <Metric label="Avg" value={overview.avg_severity || 0} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t(language, 'predictions')}</Text>
        {predictions.map((item, index) => (
          <Text key={index} style={styles.bodyText}>
            {String(item.name_en || item.area)} • {String(item.predicted_risk || item.riskScore)} • {String(item.confidence || '85')}%
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function AdminScreen({ language, ranking, load }: { language: Language; ranking: Array<Record<string, unknown>>; load: () => Promise<void> }) {
  useEffect(() => {
    load().catch((error) => Alert.alert('Risk Radar', error.message));
  }, []);

  return (
    <ScrollView style={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t(language, 'topCriminals')}</Text>
        {ranking.map((item, index) => (
          <View key={String(item.id || index)} style={styles.rankRow}>
            <Text style={styles.rankNumber}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{String(item.display_name)}</Text>
              <Text style={styles.bodyText}>{String(item.primary_crime_type || 'Unknown')} • Score {String(item.severity_score || 0)}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.privateNote}>{t(language, 'victimProfiles')}</Text>
      </View>
    </ScrollView>
  );
}

function ProfileScreen({ language, user, onLogout }: { language: Language; user: User; onLogout: () => void }) {
  const [skills, setSkills] = useState('');

  const saveVolunteer = async () => {
    await profileApi.updateVolunteer({
      skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
      serviceAreas: ['Dhaka'],
      availability: 'on_call'
    });
    Alert.alert('Risk Radar', 'Volunteer profile updated.');
  };

  return (
    <ScrollView style={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{user.fullName}</Text>
        <Text style={styles.bodyText}>{user.email}</Text>
        <Text style={styles.bodyText}>{user.role.toUpperCase()}</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t(language, 'volunteerProfile')}</Text>
        <Field label="Skills, comma separated" value={skills} onChangeText={setSkills} />
        <Pressable style={styles.primaryButton} onPress={saveVolunteer}>
          <Text style={styles.primaryButtonText}>Save</Text>
        </Pressable>
      </View>
      <Pressable style={styles.secondaryButton} onPress={onLogout}>
        <Text style={styles.secondaryButtonText}>{t(language, 'logout')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput {...props} style={[styles.input, props.multiline && styles.textArea]} placeholderTextColor="#94a3b8" />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{String(value)}</Text>
      <Text style={styles.bodyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#f8fafc' },
  authShell: { flex: 1, justifyContent: 'center', backgroundColor: '#fff7ed', padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0', borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 24, fontWeight: '800', color: '#111827' },
  tagline: { color: '#64748b', marginTop: 2 },
  languageButton: { width: 44, height: 36, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  languageText: { color: '#ffffff', fontWeight: '800' },
  authHeader: { marginBottom: 28 },
  authTitle: { fontSize: 38, fontWeight: '900', color: '#991b1b' },
  authTagline: { fontSize: 16, color: '#7c2d12', marginTop: 8 },
  content: { flex: 1, padding: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 44, borderRadius: 8, borderColor: '#cbd5e1', borderWidth: 1, paddingHorizontal: 12, backgroundColor: '#ffffff', color: '#111827' },
  searchButton: { minWidth: 84, height: 44, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: '#ffffff', fontWeight: '900' },
  searchMessage: { color: '#475569', marginBottom: 8, fontSize: 12 },
  mapWrap: { height: 360, overflow: 'hidden', borderRadius: 8, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
  panel: { backgroundColor: '#ffffff', borderRadius: 8, padding: 16, borderColor: '#e2e8f0', borderWidth: 1, marginBottom: 12 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  bodyText: { color: '#475569', lineHeight: 21 },
  metricText: { fontSize: 20, fontWeight: '800', color: '#dc2626' },
  detailBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 },
  detailTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  filterRail: { marginVertical: 12 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  chipActive: { backgroundColor: '#dc2626' },
  chipText: { color: '#334155', fontWeight: '700' },
  chipTextActive: { color: '#ffffff' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dangerButton: { flex: 1, height: 48, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  dangerButtonText: { color: '#ffffff', fontWeight: '900' },
  warnButton: { flex: 1, height: 48, borderRadius: 8, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  warnButtonText: { color: '#111827', fontWeight: '900' },
  primaryButton: { height: 48, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { color: '#ffffff', fontWeight: '800' },
  secondaryButton: { height: 46, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: '#ffffff' },
  secondaryButtonText: { color: '#111827', fontWeight: '800' },
  field: { gap: 6, marginTop: 12 },
  label: { color: '#334155', fontWeight: '700' },
  input: { minHeight: 46, borderRadius: 8, borderColor: '#cbd5e1', borderWidth: 1, paddingHorizontal: 12, backgroundColor: '#ffffff', color: '#111827' },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  segment: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 4, marginBottom: 4 },
  segmentItem: { flex: 1, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#ffffff' },
  segmentText: { color: '#475569', fontWeight: '800' },
  segmentActiveText: { color: '#dc2626' },
  tabBar: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopColor: '#e2e8f0', borderTopWidth: 1, padding: 8, gap: 6 },
  tab: { flex: 1, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: '#111827' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  activeTabText: { color: '#ffffff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metric: { width: '48%', backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  metricValue: { fontSize: 24, fontWeight: '900', color: '#dc2626' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  rankNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fee2e2', color: '#991b1b', textAlign: 'center', lineHeight: 32, fontWeight: '900' },
  privateNote: { marginTop: 14, color: '#991b1b', fontWeight: '800' }
});
