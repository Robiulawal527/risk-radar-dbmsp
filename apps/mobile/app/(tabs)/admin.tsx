import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { CrimeType, Severity, SOSStatus, UserRole, type Crime } from '@risk-radar/types';
import {
  crimeToAdminInput,
  deleteAdminCrime,
  deleteCriminalRecord,
  deleteVolunteer,
  fetchAdminApplicants,
  fetchAdminCrimes,
  fetchAdminSos,
  fetchCriminalRecords,
  fetchVolunteers,
  saveAdminCrime,
  saveCriminalRecord,
  saveVolunteer,
  updateAdminApplicantStatus,
  updateAdminSosStatus,
  type AdminApplicant,
  type AdminCrimeInput,
  type AdminCriminalRecord,
  type AdminVolunteer,
  type CriminalRecordInput,
  type VolunteerInput,
} from '@/lib/admin-data';
import { useAuthStore } from '@/store/auth';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const panels = ['Applications', 'Reports', 'SOS', 'Rankings'] as const;
type PanelKey = (typeof panels)[number];

const crimeTypes = Object.values(CrimeType) as CrimeType[];
const severities = Object.values(Severity) as Severity[];

const emptyCrime: AdminCrimeInput = {
  type: CrimeType.THEFT,
  category: CrimeType.THEFT,
  title: '',
  description: '',
  latitude: 23.8103,
  longitude: 90.4125,
  address: '',
  area: '',
  district: 'Dhaka',
  division: 'Dhaka',
  severity: Severity.MEDIUM,
  status: 'REPORTED',
  reportedBy: 'Mobile Admin',
};

const emptyCriminal: Omit<CriminalRecordInput, 'id'> = {
  name: '',
  description: '',
  knownAliases: [],
  status: 'UNDER_REVIEW',
  crimeCount: 1,
  intensity: 1,
  mostFrequentCrime: CrimeType.THEFT,
};

const emptyVolunteer: Omit<VolunteerInput, 'id'> = {
  name: '',
  email: '',
  phone: '',
  skills: [],
  status: 'ACTIVE',
  activityCount: 1,
  intensity: 1,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(status: string) {
  const normalized = status.toUpperCase();
  if (['ACTIVE', 'RESOLVED', 'APPROVED', 'VERIFIED'].includes(normalized)) return COLORS.success;
  if (['REJECTED', 'CRITICAL', 'DELETED'].includes(normalized)) return COLORS.danger;
  if (['PENDING', 'UNDER_REVIEW', 'REPORTED'].includes(normalized)) return COLORS.warning;
  return COLORS.accent;
}

function matchesSearch(values: Array<string | number | null | undefined>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(needle)
  );
}

export default function AdminScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = String(user?.role ?? '').toUpperCase() === UserRole.ADMIN;
  const [activePanel, setActivePanel] = useState<PanelKey>('Applications');
  const [search, setSearch] = useState('');
  const [crimeForm, setCrimeForm] = useState<AdminCrimeInput>(emptyCrime);
  const [criminalForm, setCriminalForm] = useState<Omit<CriminalRecordInput, 'id'>>({
    ...emptyCriminal,
  });
  const [volunteerForm, setVolunteerForm] = useState<Omit<VolunteerInput, 'id'>>({
    ...emptyVolunteer,
  });
  const [criminalEditId, setCriminalEditId] = useState<string | undefined>();
  const [volunteerEditId, setVolunteerEditId] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const applicantsQ = useQuery({
    queryKey: ['mobile-admin-applicants'],
    queryFn: () => fetchAdminApplicants(80),
    enabled: isAdmin,
  });
  const crimesQ = useQuery({
    queryKey: ['mobile-admin-crimes'],
    queryFn: () => fetchAdminCrimes(80),
    enabled: isAdmin,
  });
  const sosQ = useQuery({
    queryKey: ['mobile-admin-sos'],
    queryFn: () => fetchAdminSos(80),
    enabled: isAdmin,
  });
  const criminalsQ = useQuery({
    queryKey: ['mobile-admin-criminals'],
    queryFn: () => fetchCriminalRecords(80),
    enabled: isAdmin,
  });
  const volunteersQ = useQuery({
    queryKey: ['mobile-admin-volunteers'],
    queryFn: () => fetchVolunteers(80),
    enabled: isAdmin,
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mobile-admin-applicants'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-admin-crimes'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-admin-sos'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-admin-criminals'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-admin-volunteers'] }),
      queryClient.invalidateQueries({ queryKey: ['map-crimes'] }),
      queryClient.invalidateQueries({ queryKey: ['active-sos-alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['community-rankings'] }),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll().finally(() => setRefreshing(false));
  };

  const stats = useMemo(() => {
    const crimes = crimesQ.data ?? [];
    const sos = sosQ.data ?? [];
    const applicants = applicantsQ.data ?? [];
    return {
      reports: crimes.length,
      critical: crimes.filter((crime) => crime.severity === Severity.CRITICAL).length,
      activeSos: sos.filter((alert) => alert.status === SOSStatus.ACTIVE).length,
      pendingAdmins: applicants.filter((applicant) => applicant.status.toUpperCase() === 'PENDING')
        .length,
    };
  }, [applicantsQ.data, crimesQ.data, sosQ.data]);

  const applicants = useMemo(
    () =>
      (applicantsQ.data ?? []).filter((applicant) =>
        matchesSearch(
          [applicant.name, applicant.email, applicant.phone, applicant.nidNumber, applicant.status],
          search
        )
      ),
    [applicantsQ.data, search]
  );
  const crimes = useMemo(
    () =>
      (crimesQ.data ?? []).filter((crime) =>
        matchesSearch(
          [
            crime.title,
            crime.type,
            crime.severity,
            crime.status,
            crime.location.area,
            crime.location.district,
          ],
          search
        )
      ),
    [crimesQ.data, search]
  );
  const sos = useMemo(
    () =>
      (sosQ.data ?? []).filter((alert) =>
        matchesSearch(
          [alert.message, alert.status, alert.location.address, alert.location.area],
          search
        )
      ),
    [sosQ.data, search]
  );
  const criminals = useMemo(
    () =>
      (criminalsQ.data ?? []).filter((row) =>
        matchesSearch([row.name, row.status, row.mostFrequentCrime, ...row.knownAliases], search)
      ),
    [criminalsQ.data, search]
  );
  const volunteers = useMemo(
    () =>
      (volunteersQ.data ?? []).filter((row) =>
        matchesSearch([row.name, row.email, row.phone, row.status, ...row.skills], search)
      ),
    [volunteersQ.data, search]
  );

  const saveCrimeM = useMutation({
    mutationFn: saveAdminCrime,
    onSuccess: async () => {
      Alert.alert('Saved', crimeForm.id ? 'Crime report updated.' : 'Crime report added.');
      setCrimeForm(emptyCrime);
      await refreshAll();
    },
    onError: (error) => Alert.alert('Could not save report', getErrorMessage(error, 'Try again.')),
  });
  const deleteCrimeM = useMutation({
    mutationFn: deleteAdminCrime,
    onSuccess: refreshAll,
    onError: (error) =>
      Alert.alert('Could not delete report', getErrorMessage(error, 'Try again.')),
  });
  const reviewAdminM = useMutation({
    mutationFn: ({
      applicant,
      status,
    }: {
      applicant: AdminApplicant;
      status: 'ACTIVE' | 'REJECTED';
    }) => updateAdminApplicantStatus(applicant, status),
    onSuccess: async (_data, variables) => {
      Alert.alert(variables.status === 'ACTIVE' ? 'Admin approved' : 'Admin rejected');
      await refreshAll();
    },
    onError: (error) =>
      Alert.alert('Could not update application', getErrorMessage(error, 'Try again.')),
  });
  const updateSosM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SOSStatus }) =>
      updateAdminSosStatus(id, status),
    onSuccess: refreshAll,
    onError: (error) => Alert.alert('Could not update SOS', getErrorMessage(error, 'Try again.')),
  });
  const saveCriminalM = useMutation({
    mutationFn: saveCriminalRecord,
    onSuccess: async () => {
      setCriminalEditId(undefined);
      setCriminalForm({ ...emptyCriminal });
      await refreshAll();
    },
    onError: (error) => Alert.alert('Could not save record', getErrorMessage(error, 'Try again.')),
  });
  const deleteCriminalM = useMutation({
    mutationFn: deleteCriminalRecord,
    onSuccess: refreshAll,
    onError: (error) =>
      Alert.alert('Could not delete record', getErrorMessage(error, 'Try again.')),
  });
  const saveVolunteerM = useMutation({
    mutationFn: saveVolunteer,
    onSuccess: async () => {
      setVolunteerEditId(undefined);
      setVolunteerForm({ ...emptyVolunteer });
      await refreshAll();
    },
    onError: (error) =>
      Alert.alert('Could not save volunteer', getErrorMessage(error, 'Try again.')),
  });
  const deleteVolunteerM = useMutation({
    mutationFn: deleteVolunteer,
    onSuccess: refreshAll,
    onError: (error) =>
      Alert.alert('Could not delete volunteer', getErrorMessage(error, 'Try again.')),
  });

  const firstError = [applicantsQ, crimesQ, sosQ, criminalsQ, volunteersQ].find(
    (query) => query.isError
  )?.error;

  if (!isAdmin) {
    return (
      <View style={styles.locked}>
        <MaterialIcons name="admin-panel-settings" size={42} color={COLORS.warning} />
        <Text style={styles.lockedTitle}>Admin access required</Text>
        <Text style={styles.lockedText}>
          Use an approved admin account to manage operations from mobile.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="admin-panel-settings" size={25} color={COLORS.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Admin Command</Text>
          <Text style={styles.subtitle}>Review applications, incidents, SOS, and rankings.</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <Stat label="Reports" value={stats.reports} color={COLORS.accent} />
        <Stat label="Critical" value={stats.critical} color={COLORS.danger} />
        <Stat label="Live SOS" value={stats.activeSos} color={COLORS.warning} />
        <Stat label="Pending" value={stats.pendingAdmins} color={COLORS.success} />
      </View>

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search admin records"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {firstError ? (
        <Text style={styles.warning}>
          {getErrorMessage(firstError, 'Some admin data could not load.')}
        </Text>
      ) : null}

      <View style={styles.tabs}>
        {panels.map((panel) => (
          <TouchableOpacity
            key={panel}
            style={[styles.tab, activePanel === panel && styles.tabActive]}
            onPress={() => setActivePanel(panel)}
          >
            <Text style={[styles.tabText, activePanel === panel && styles.tabTextActive]}>
              {panel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activePanel === 'Applications' ? (
        <Section
          title="Admin Applications"
          count={applicants.length}
          loading={applicantsQ.isLoading}
        >
          {applicants.map((applicant) => (
            <ApplicantCard
              key={applicant.id}
              applicant={applicant}
              busy={reviewAdminM.isPending}
              onApprove={() => reviewAdminM.mutate({ applicant, status: 'ACTIVE' })}
              onReject={() => reviewAdminM.mutate({ applicant, status: 'REJECTED' })}
            />
          ))}
          {!applicantsQ.isLoading && !applicants.length ? (
            <Empty text="No applications found." />
          ) : null}
        </Section>
      ) : null}

      {activePanel === 'Reports' ? (
        <>
          <Section
            title={crimeForm.id ? 'Update Crime Report' : 'Add Crime Report'}
            loading={saveCrimeM.isPending}
          >
            <CrimeForm
              form={crimeForm}
              setForm={setCrimeForm}
              saving={saveCrimeM.isPending}
              onSubmit={() => {
                if (!crimeForm.title.trim() || !crimeForm.description.trim()) {
                  Alert.alert('Missing details', 'Title and description are required.');
                  return;
                }
                saveCrimeM.mutate(crimeForm);
              }}
              onCancel={() => setCrimeForm(emptyCrime)}
            />
          </Section>
          <Section title="Crime Reports" count={crimes.length} loading={crimesQ.isLoading}>
            {crimes.map((crime) => (
              <CrimeCard
                key={crime.id}
                crime={crime}
                onEdit={() => setCrimeForm(crimeToAdminInput(crime))}
                onDelete={() =>
                  Alert.alert('Delete report?', crime.title, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteCrimeM.mutate(crime.id),
                    },
                  ])
                }
              />
            ))}
            {!crimesQ.isLoading && !crimes.length ? <Empty text="No reports found." /> : null}
          </Section>
        </>
      ) : null}

      {activePanel === 'SOS' ? (
        <Section
          title="SOS Review"
          count={sos.length}
          loading={sosQ.isLoading || updateSosM.isPending}
        >
          {sos.map((alert) => (
            <SosCard
              key={alert.id}
              alert={alert}
              busy={updateSosM.isPending}
              onStatus={(status) => updateSosM.mutate({ id: alert.id, status })}
            />
          ))}
          {!sosQ.isLoading && !sos.length ? <Empty text="No SOS reports found." /> : null}
        </Section>
      ) : null}

      {activePanel === 'Rankings' ? (
        <>
          <Section title="Criminal Records" count={criminals.length} loading={criminalsQ.isLoading}>
            <CriminalForm
              form={criminalForm}
              setForm={setCriminalForm}
              saving={saveCriminalM.isPending}
              editing={Boolean(criminalEditId)}
              onCancel={() => {
                setCriminalEditId(undefined);
                setCriminalForm({ ...emptyCriminal });
              }}
              onSubmit={() => {
                if (!criminalForm.name.trim()) {
                  Alert.alert('Name required');
                  return;
                }
                saveCriminalM.mutate({ ...criminalForm, id: criminalEditId });
              }}
            />
            {criminals.map((row) => (
              <RankCard
                key={row.id}
                title={row.name}
                subtitle={`${row.crimeCount} incidents • ${row.intensity} intensity • ${row.mostFrequentCrime}`}
                score={row.score}
                status={row.status}
                onEdit={() => {
                  setCriminalEditId(row.id);
                  setCriminalForm({
                    name: row.name,
                    description: row.description,
                    knownAliases: row.knownAliases,
                    status: row.status,
                    crimeCount: row.crimeCount,
                    intensity: row.intensity,
                    mostFrequentCrime: row.mostFrequentCrime,
                  });
                }}
                onDelete={() =>
                  Alert.alert('Delete criminal record?', row.name, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteCriminalM.mutate(row.id),
                    },
                  ])
                }
              />
            ))}
            {!criminalsQ.isLoading && !criminals.length ? (
              <Empty text="No criminal records found." />
            ) : null}
          </Section>

          <Section title="Volunteers" count={volunteers.length} loading={volunteersQ.isLoading}>
            <VolunteerForm
              form={volunteerForm}
              setForm={setVolunteerForm}
              saving={saveVolunteerM.isPending}
              editing={Boolean(volunteerEditId)}
              onCancel={() => {
                setVolunteerEditId(undefined);
                setVolunteerForm({ ...emptyVolunteer });
              }}
              onSubmit={() => {
                if (!volunteerForm.name.trim()) {
                  Alert.alert('Name required');
                  return;
                }
                saveVolunteerM.mutate({ ...volunteerForm, id: volunteerEditId });
              }}
            />
            {volunteers.map((row) => (
              <RankCard
                key={row.id}
                title={row.name}
                subtitle={`${row.activityCount} activities • ${row.intensity} intensity`}
                score={row.score}
                status={row.status}
                onEdit={() => {
                  setVolunteerEditId(row.id);
                  setVolunteerForm({
                    name: row.name,
                    email: row.email ?? '',
                    phone: row.phone ?? '',
                    skills: row.skills,
                    status: row.status,
                    activityCount: row.activityCount,
                    intensity: row.intensity,
                  });
                }}
                onDelete={() =>
                  Alert.alert('Delete volunteer?', row.name, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteVolunteerM.mutate(row.id),
                    },
                  ])
                }
              />
            ))}
            {!volunteersQ.isLoading && !volunteers.length ? (
              <Empty text="No volunteers found." />
            ) : null}
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  count,
  loading,
  children,
}: {
  title: string;
  count?: number;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionRight}>
          {typeof count === 'number' ? <Text style={styles.countPill}>{count}</Text> : null}
          {loading ? <ActivityIndicator color={COLORS.accent} /> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Badge({ label }: { label: string }) {
  const color = statusColor(label);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20`, borderColor: `${color}66` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function ApplicantCard({
  applicant,
  busy,
  onApprove,
  onReject,
}: {
  applicant: AdminApplicant;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isActive = applicant.status.toUpperCase() === 'ACTIVE';
  const isRejected = applicant.status.toUpperCase() === 'REJECTED';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(applicant.name || applicant.email || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {applicant.name}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {applicant.email}
          </Text>
        </View>
        <Badge label={applicant.status} />
      </View>
      <Text style={styles.detail}>NID: {applicant.nidNumber || 'Not provided'}</Text>
      <Text style={styles.detail}>
        Education: {applicant.education || "Bachelor's degree"}
        {applicant.educationField ? `, ${applicant.educationField}` : ''}
      </Text>
      {applicant.phone ? <Text style={styles.detail}>Phone: {applicant.phone}</Text> : null}
      <View style={styles.actions}>
        <ActionButton
          label="Approve"
          icon="check-circle"
          disabled={busy || isActive}
          onPress={onApprove}
        />
        <ActionButton
          label="Reject"
          icon="cancel"
          danger
          disabled={busy || isRejected}
          onPress={onReject}
        />
      </View>
    </View>
  );
}

function CrimeCard({
  crime,
  onEdit,
  onDelete,
}: {
  crime: Crime;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {crime.title}
          </Text>
          <Text style={styles.muted}>
            {crime.location.area || crime.location.district || 'Unknown area'} • {crime.type}
          </Text>
        </View>
        <Badge label={crime.severity} />
      </View>
      <Text style={styles.detail} numberOfLines={2}>
        {crime.description}
      </Text>
      <View style={styles.actions}>
        <ActionButton label="Edit" icon="edit" onPress={onEdit} />
        <ActionButton label="Delete" icon="delete-outline" danger onPress={onDelete} />
      </View>
    </View>
  );
}

function SosCard({
  alert,
  busy,
  onStatus,
}: {
  alert: {
    id: string;
    message?: string;
    status: SOSStatus;
    createdAt: Date;
    location: { latitude: number; longitude: number; address?: string };
  };
  busy: boolean;
  onStatus: (status: SOSStatus) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{alert.message || 'Emergency assistance requested'}</Text>
          <Text style={styles.muted}>
            {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)}
          </Text>
        </View>
        <Badge label={alert.status} />
      </View>
      <Text style={styles.detail}>{new Date(alert.createdAt).toLocaleString()}</Text>
      <View style={styles.actions}>
        {Object.values(SOSStatus).map((status) => (
          <ActionButton
            key={status}
            label={status}
            icon={status === SOSStatus.ACTIVE ? 'emergency' : 'check-circle'}
            disabled={busy || status === alert.status}
            danger={status === SOSStatus.ACTIVE}
            onPress={() => onStatus(status)}
          />
        ))}
      </View>
    </View>
  );
}

function RankCard({
  title,
  subtitle,
  score,
  status,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  score: number;
  status: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreValue}>{Math.round(score)}</Text>
          <Text style={styles.scoreLabel}>SCORE</Text>
        </View>
      </View>
      <Badge label={status} />
      <View style={styles.actions}>
        <ActionButton label="Edit" icon="edit" onPress={onEdit} />
        <ActionButton label="Delete" icon="delete-outline" danger onPress={onDelete} />
      </View>
    </View>
  );
}

function CrimeForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
}: {
  form: AdminCrimeInput;
  setForm: (form: AdminCrimeInput) => void;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.form}>
      <Field
        label="Title"
        value={form.title}
        onChangeText={(title) => setForm({ ...form, title })}
      />
      <Field
        label="Description"
        value={form.description}
        onChangeText={(description) => setForm({ ...form, description })}
        multiline
      />
      <ChoiceRow
        label="Type"
        values={crimeTypes}
        value={form.type}
        onChange={(type) => setForm({ ...form, type, category: type })}
      />
      <ChoiceRow
        label="Severity"
        values={severities}
        value={form.severity}
        onChange={(severity) => setForm({ ...form, severity })}
      />
      <View style={styles.twoColumn}>
        <Field
          label="Area"
          value={form.area ?? ''}
          onChangeText={(area) => setForm({ ...form, area })}
        />
        <Field
          label="District"
          value={form.district ?? ''}
          onChangeText={(district) => setForm({ ...form, district })}
        />
      </View>
      <View style={styles.twoColumn}>
        <Field
          label="Latitude"
          value={String(form.latitude)}
          keyboardType="numeric"
          onChangeText={(latitude) => setForm({ ...form, latitude: Number(latitude) })}
        />
        <Field
          label="Longitude"
          value={String(form.longitude)}
          keyboardType="numeric"
          onChangeText={(longitude) => setForm({ ...form, longitude: Number(longitude) })}
        />
      </View>
      <View style={styles.actions}>
        <ActionButton
          label={saving ? 'Saving' : form.id ? 'Update' : 'Add'}
          icon="save"
          disabled={saving}
          onPress={onSubmit}
        />
        {form.id ? <ActionButton label="Cancel" icon="close" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function CriminalForm({
  form,
  setForm,
  saving,
  editing,
  onSubmit,
  onCancel,
}: {
  form: Omit<CriminalRecordInput, 'id'>;
  setForm: (form: Omit<CriminalRecordInput, 'id'>) => void;
  saving: boolean;
  editing: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.form}>
      <Field label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <Field
        label="Description"
        value={form.description}
        onChangeText={(description) => setForm({ ...form, description })}
        multiline
      />
      <ChoiceRow
        label="Frequent crime"
        values={crimeTypes}
        value={form.mostFrequentCrime}
        onChange={(mostFrequentCrime) => setForm({ ...form, mostFrequentCrime })}
      />
      <View style={styles.twoColumn}>
        <Field
          label="Incidents"
          value={String(form.crimeCount)}
          keyboardType="numeric"
          onChangeText={(crimeCount) => setForm({ ...form, crimeCount: Number(crimeCount) })}
        />
        <Field
          label="Intensity"
          value={String(form.intensity)}
          keyboardType="numeric"
          onChangeText={(intensity) => setForm({ ...form, intensity: Number(intensity) })}
        />
      </View>
      <Field
        label="Aliases"
        value={form.knownAliases.join(', ')}
        onChangeText={(value) => setForm({ ...form, knownAliases: splitCsv(value) })}
      />
      <View style={styles.actions}>
        <ActionButton
          label={saving ? 'Saving' : editing ? 'Update' : 'Add'}
          icon="save"
          disabled={saving}
          onPress={onSubmit}
        />
        {editing ? <ActionButton label="Cancel" icon="close" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function VolunteerForm({
  form,
  setForm,
  saving,
  editing,
  onSubmit,
  onCancel,
}: {
  form: Omit<VolunteerInput, 'id'>;
  setForm: (form: Omit<VolunteerInput, 'id'>) => void;
  saving: boolean;
  editing: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.form}>
      <Field label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <Field
        label="Email"
        value={form.email ?? ''}
        onChangeText={(email) => setForm({ ...form, email })}
      />
      <Field
        label="Phone"
        value={form.phone ?? ''}
        keyboardType="phone-pad"
        onChangeText={(phone) => setForm({ ...form, phone })}
      />
      <View style={styles.twoColumn}>
        <Field
          label="Activities"
          value={String(form.activityCount)}
          keyboardType="numeric"
          onChangeText={(activityCount) =>
            setForm({ ...form, activityCount: Number(activityCount) })
          }
        />
        <Field
          label="Impact"
          value={String(form.intensity)}
          keyboardType="numeric"
          onChangeText={(intensity) => setForm({ ...form, intensity: Number(intensity) })}
        />
      </View>
      <Field
        label="Skills"
        value={form.skills.join(', ')}
        onChangeText={(value) => setForm({ ...form, skills: splitCsv(value) })}
      />
      <View style={styles.actions}>
        <ActionButton
          label={saving ? 'Saving' : editing ? 'Update' : 'Add'}
          icon="save"
          disabled={saving}
          onPress={onSubmit}
        />
        {editing ? <ActionButton label="Cancel" icon="close" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={COLORS.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function ChoiceRow<T extends string>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {values.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, value === item && styles.chipActive]}
            onPress={() => onChange(item)}
          >
            <Text style={[styles.chipText, value === item && styles.chipTextActive]}>
              {formatLabel(item)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        danger && styles.actionDanger,
        disabled && styles.actionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialIcons name={icon} size={16} color={danger ? '#fff' : COLORS.bg} />
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingTop: 54, paddingBottom: 120 },
  locked: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  lockedTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginTop: SPACING.md },
  lockedText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text, fontSize: 29, letterSpacing: 0 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  searchBar: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '700' },
  warning: { color: COLORS.warning, marginBottom: SPACING.md, fontSize: 12, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tab: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  tabText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900' },
  tabTextActive: { color: COLORS.bg },
  section: {
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, flex: 1 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  countPill: { color: COLORS.accent, fontSize: 12, fontWeight: '900' },
  card: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardMain: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  muted: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  detail: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.bg, fontSize: 18, fontWeight: '900' },
  badge: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
  },
  badgeText: { fontSize: 10, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  actionButton: {
    minHeight: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  actionDanger: { backgroundColor: COLORS.danger },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: COLORS.bg, fontSize: 11, fontWeight: '900' },
  actionTextDanger: { color: '#fff' },
  scoreBox: { minWidth: 50, alignItems: 'flex-end' },
  scoreValue: { color: COLORS.accent, fontSize: 19, fontWeight: '900' },
  scoreLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900' },
  form: { gap: SPACING.sm, marginBottom: SPACING.md },
  field: { flex: 1 },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.sm,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  textarea: { minHeight: 92, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: COLORS.bg },
  twoColumn: { flexDirection: 'row', gap: SPACING.sm },
  empty: {
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    fontSize: 13,
  },
});
