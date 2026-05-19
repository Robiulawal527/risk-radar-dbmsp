'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import { CrimeType, Severity, SOSStatus, type Crime } from '@/lib/types';
import {
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
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  Gavel,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PHONE_HINT, requireValidPhoneNumber } from '@/lib/validation';

const crimeTypes = Object.values(CrimeType);
const severities = Object.values(Severity);
const sosStatuses = Object.values(SOSStatus);
const panels = ['Applications', 'Reports', 'SOS', 'Rankings'] as const;

type PanelKey = (typeof panels)[number];

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
  reportedBy: 'Admin',
};

const emptyCriminal: Omit<CriminalRecordInput, 'id'> = {
  name: '',
  age: null,
  gender: '',
  description: '',
  knownAliases: [],
  photoUrl: '',
  status: 'UNDER_REVIEW',
  crimeCount: 1,
  intensity: 1,
  mostFrequentCrime: CrimeType.THEFT,
};

const emptyVolunteer: Omit<VolunteerInput, 'id'> = {
  name: '',
  email: '',
  phone: '',
  avatar: '',
  skills: [],
  status: 'ACTIVE',
  activityCount: 1,
  intensity: 1,
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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

function crimeToInput(crime: Crime): AdminCrimeInput {
  return {
    id: crime.id,
    type: crime.type,
    category: crime.category,
    title: crime.title,
    description: crime.description,
    latitude: crime.location.latitude,
    longitude: crime.location.longitude,
    address: crime.location.address ?? '',
    area: crime.location.area ?? '',
    district: crime.location.district ?? '',
    division: crime.location.division ?? '',
    severity: crime.severity,
    status: crime.status,
    reportedBy: crime.reportedBy,
    dateTime: new Date(crime.dateTime).toISOString(),
  };
}

function statusVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toUpperCase();
  if (['ACTIVE', 'RESOLVED', 'APPROVED', 'VERIFIED'].includes(normalized)) return 'success';
  if (['REJECTED', 'CRITICAL', 'DELETED'].includes(normalized)) return 'destructive';
  if (['PENDING', 'UNDER_REVIEW', 'REPORTED'].includes(normalized)) return 'warning';
  return 'secondary';
}

function severityVariant(severity: Severity): BadgeProps['variant'] {
  if (severity === Severity.CRITICAL || severity === Severity.HIGH) return 'destructive';
  if (severity === Severity.MEDIUM) return 'warning';
  return 'success';
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
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

  const isAdmin = String(user?.role ?? '').toUpperCase() === 'ADMIN';

  const crimesQ = useQuery({
    queryKey: ['admin-crimes'],
    queryFn: () => fetchAdminCrimes(80),
    enabled: isAdmin,
  });
  const sosQ = useQuery({
    queryKey: ['admin-sos'],
    queryFn: () => fetchAdminSos(80),
    enabled: isAdmin,
  });
  const criminalsQ = useQuery({
    queryKey: ['admin-criminals'],
    queryFn: () => fetchCriminalRecords(80),
    enabled: isAdmin,
  });
  const volunteersQ = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => fetchVolunteers(80),
    enabled: isAdmin,
  });
  const applicantsQ = useQuery({
    queryKey: ['admin-applicants'],
    queryFn: () => fetchAdminApplicants(80),
    enabled: isAdmin,
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-crimes'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-sos'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-criminals'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-applicants'] }),
      queryClient.invalidateQueries({ queryKey: ['map-crimes'] }),
      queryClient.invalidateQueries({ queryKey: ['rankings-criminals'] }),
      queryClient.invalidateQueries({ queryKey: ['rankings-philanthropists'] }),
    ]);
  };

  const stats = useMemo(() => {
    const crimes = crimesQ.data ?? [];
    const sos = sosQ.data ?? [];
    const applicants = applicantsQ.data ?? [];
    return {
      crimes: crimes.length,
      critical: crimes.filter((crime) => crime.severity === Severity.CRITICAL).length,
      activeSos: sos.filter((alert) => alert.status === SOSStatus.ACTIVE).length,
      volunteers: volunteersQ.data?.length ?? 0,
      pendingAdmins: applicants.filter((applicant) => applicant.status.toUpperCase() === 'PENDING')
        .length,
    };
  }, [applicantsQ.data, crimesQ.data, sosQ.data, volunteersQ.data]);

  const filteredApplicants = useMemo(
    () =>
      (applicantsQ.data ?? []).filter((applicant) =>
        matchesSearch(
          [
            applicant.name,
            applicant.email,
            applicant.phone,
            applicant.nidNumber,
            applicant.education,
            applicant.educationField,
            applicant.status,
          ],
          search
        )
      ),
    [applicantsQ.data, search]
  );

  const filteredCrimes = useMemo(
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

  const filteredSos = useMemo(
    () =>
      (sosQ.data ?? []).filter((alert) =>
        matchesSearch([alert.message, alert.status, alert.location.address], search)
      ),
    [sosQ.data, search]
  );

  const filteredCriminals = useMemo(
    () =>
      (criminalsQ.data ?? []).filter((row) =>
        matchesSearch(
          [row.name, row.description, row.status, row.mostFrequentCrime, ...row.knownAliases],
          search
        )
      ),
    [criminalsQ.data, search]
  );

  const filteredVolunteers = useMemo(
    () =>
      (volunteersQ.data ?? []).filter((row) =>
        matchesSearch([row.name, row.email, row.phone, row.status, ...row.skills], search)
      ),
    [volunteersQ.data, search]
  );

  const isRefreshing =
    crimesQ.isFetching ||
    sosQ.isFetching ||
    criminalsQ.isFetching ||
    volunteersQ.isFetching ||
    applicantsQ.isFetching;

  const firstQueryError = [applicantsQ, crimesQ, sosQ, criminalsQ, volunteersQ].find(
    (query) => query.isError
  )?.error;

  const saveCrimeM = useMutation({
    mutationFn: saveAdminCrime,
    onSuccess: async () => {
      toast.success(crimeForm.id ? 'Crime report updated' : 'Crime report added');
      setCrimeForm(emptyCrime);
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not save crime report')),
  });

  const deleteCrimeM = useMutation({
    mutationFn: deleteAdminCrime,
    onSuccess: async () => {
      toast.success('Crime report deleted');
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not delete crime report')),
  });

  const saveCriminalM = useMutation({
    mutationFn: saveCriminalRecord,
    onSuccess: async () => {
      toast.success(criminalEditId ? 'Criminal record updated' : 'Criminal record added');
      setCriminalEditId(undefined);
      setCriminalForm({ ...emptyCriminal });
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not save criminal record')),
  });

  const deleteCriminalM = useMutation({
    mutationFn: deleteCriminalRecord,
    onSuccess: async () => {
      toast.success('Criminal record deleted');
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not delete criminal record')),
  });

  const saveVolunteerM = useMutation({
    mutationFn: (input: VolunteerInput) => {
      const phone = requireValidPhoneNumber(input.phone ?? '');
      return saveVolunteer({ ...input, phone });
    },
    onSuccess: async () => {
      toast.success(volunteerEditId ? 'Volunteer updated' : 'Volunteer added');
      setVolunteerEditId(undefined);
      setVolunteerForm({ ...emptyVolunteer });
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not save volunteer')),
  });

  const deleteVolunteerM = useMutation({
    mutationFn: deleteVolunteer,
    onSuccess: async () => {
      toast.success('Volunteer deleted');
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not delete volunteer')),
  });

  const updateSosM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SOSStatus }) =>
      updateAdminSosStatus(id, status),
    onSuccess: async () => {
      toast.success('SOS status updated');
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update SOS status')),
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
      toast.success(variables.status === 'ACTIVE' ? 'Admin approved' : 'Admin rejected');
      await refreshAll();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update admin application')),
  });

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-2xl rounded-lg border-amber-500/30 bg-amber-500/10 p-6">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
          <div>
            <h1 className="text-2xl font-black">Admin access required</h1>
            <p className="mt-2 text-sm text-slate-300">
              Sign in with an admin account to manage records, reports, SOS review, and rankings.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <header className="rounded-lg border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-teal-500/40 text-teal-200">
              Admin command
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Operations dashboard
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
              <span>Signed in as {user?.name || user?.email || 'admin'}</span>
              <span className="hidden sm:inline">•</span>
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records"
                className="h-10 rounded-lg pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={refreshAll}
              disabled={isRefreshing}
              className="h-10 rounded-lg border-white/20 bg-white/5"
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={<FileWarning />} label="Reports" value={stats.crimes} tone="teal" />
        <Stat icon={<AlertTriangle />} label="Critical" value={stats.critical} tone="red" />
        <Stat icon={<ShieldAlert />} label="Active SOS" value={stats.activeSos} tone="amber" />
        <Stat icon={<Users />} label="Volunteers" value={stats.volunteers} tone="indigo" />
        <Stat
          icon={<UserCheck />}
          label="Pending admins"
          value={stats.pendingAdmins}
          tone="emerald"
        />
      </div>

      {firstQueryError ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {getErrorMessage(firstQueryError, 'Could not load part of the admin dashboard.')}
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {panels.map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => setActivePanel(panel)}
            className={`h-10 shrink-0 rounded-md px-4 text-sm font-semibold transition ${
              activePanel === panel
                ? 'bg-white text-slate-950'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {panel}
          </button>
        ))}
      </div>

      {activePanel === 'Applications' ? (
        <Panel
          icon={<UserCheck />}
          title="Admin applications"
          count={filteredApplicants.length}
          busy={applicantsQ.isLoading}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            {applicantsQ.isLoading ? <LoadingRow /> : null}
            {filteredApplicants.map((applicant) => (
              <ApplicantRow
                key={applicant.id}
                applicant={applicant}
                busy={reviewAdminM.isPending}
                onApprove={() => reviewAdminM.mutate({ applicant, status: 'ACTIVE' })}
                onReject={() => reviewAdminM.mutate({ applicant, status: 'REJECTED' })}
              />
            ))}
            {!applicantsQ.isLoading && !filteredApplicants.length ? (
              <Empty
                text={search ? 'No applications match your search.' : 'No admin applications yet.'}
              />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {activePanel === 'Reports' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
          <Panel
            icon={<Plus />}
            title={crimeForm.id ? 'Update crime report' : 'Add crime report'}
            busy={saveCrimeM.isPending}
          >
            <CrimeForm
              form={crimeForm}
              saving={saveCrimeM.isPending}
              setForm={setCrimeForm}
              onCancel={() => setCrimeForm(emptyCrime)}
              onSubmit={() => {
                if (!crimeForm.title.trim() || !crimeForm.description.trim()) {
                  toast.error('Title and description are required.');
                  return;
                }
                if (!Number.isFinite(crimeForm.latitude) || !Number.isFinite(crimeForm.longitude)) {
                  toast.error('Valid coordinates are required.');
                  return;
                }
                saveCrimeM.mutate(crimeForm);
              }}
            />
          </Panel>

          <Panel
            icon={<AlertTriangle />}
            title="Crime report management"
            count={filteredCrimes.length}
            busy={crimesQ.isLoading}
          >
            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {crimesQ.isLoading ? <LoadingRow /> : null}
              {filteredCrimes.map((crime) => (
                <CrimeRow
                  key={crime.id}
                  crime={crime}
                  deleting={deleteCrimeM.isPending}
                  onEdit={() => {
                    setCrimeForm(crimeToInput(crime));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onDelete={() => {
                    if (window.confirm('Delete this crime report?')) {
                      deleteCrimeM.mutate(crime.id);
                    }
                  }}
                />
              ))}
              {!crimesQ.isLoading && !filteredCrimes.length ? (
                <Empty
                  text={search ? 'No reports match your search.' : 'No crime reports found.'}
                />
              ) : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {activePanel === 'SOS' ? (
        <Panel
          icon={<ShieldAlert />}
          title="Review SOS reports"
          count={filteredSos.length}
          busy={sosQ.isLoading || updateSosM.isPending}
        >
          <div className="max-h-[680px] space-y-2 overflow-auto pr-1">
            {sosQ.isLoading ? <LoadingRow /> : null}
            {filteredSos.map((alert) => (
              <SosRow
                key={alert.id}
                alert={alert}
                busy={updateSosM.isPending}
                onStatus={(status) => updateSosM.mutate({ id: alert.id, status })}
              />
            ))}
            {!sosQ.isLoading && !filteredSos.length ? (
              <Empty
                text={search ? 'No SOS reports match your search.' : 'No SOS reports found.'}
              />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {activePanel === 'Rankings' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel
            icon={<Gavel />}
            title="Criminal records"
            count={filteredCriminals.length}
            busy={criminalsQ.isLoading || saveCriminalM.isPending || deleteCriminalM.isPending}
          >
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
                  toast.error('Criminal record name is required.');
                  return;
                }
                saveCriminalM.mutate({ ...criminalForm, id: criminalEditId });
              }}
            />
            <RecordList
              loading={criminalsQ.isLoading}
              rows={filteredCriminals}
              emptyText={
                search ? 'No criminal records match your search.' : 'No criminal records yet.'
              }
              render={(row) => (
                <RankRow
                  key={row.id}
                  title={row.name}
                  subtitle={`${row.crimeCount} incidents • ${row.intensity} intensity • ${row.mostFrequentCrime}`}
                  status={row.status}
                  score={row.score}
                  onEdit={() => {
                    setCriminalEditId(row.id);
                    setCriminalForm({
                      name: row.name,
                      age: row.age ?? null,
                      gender: row.gender ?? '',
                      description: row.description,
                      knownAliases: row.knownAliases,
                      photoUrl: row.photoUrl ?? '',
                      status: row.status,
                      crimeCount: row.crimeCount,
                      intensity: row.intensity,
                      mostFrequentCrime: row.mostFrequentCrime,
                    });
                  }}
                  onDelete={() => {
                    if (window.confirm('Delete this criminal record?')) {
                      deleteCriminalM.mutate(row.id);
                    }
                  }}
                />
              )}
            />
          </Panel>

          <Panel
            icon={<Users />}
            title="Volunteers"
            count={filteredVolunteers.length}
            busy={volunteersQ.isLoading || saveVolunteerM.isPending || deleteVolunteerM.isPending}
          >
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
                  toast.error('Volunteer name is required.');
                  return;
                }
                saveVolunteerM.mutate({ ...volunteerForm, id: volunteerEditId });
              }}
            />
            <RecordList
              loading={volunteersQ.isLoading}
              rows={filteredVolunteers}
              emptyText={search ? 'No volunteers match your search.' : 'No volunteers yet.'}
              render={(row) => (
                <RankRow
                  key={row.id}
                  title={row.name}
                  subtitle={`${row.activityCount} activities • ${row.intensity} intensity`}
                  status={row.status}
                  score={row.score}
                  onEdit={() => {
                    setVolunteerEditId(row.id);
                    setVolunteerForm({
                      name: row.name,
                      email: row.email ?? '',
                      phone: row.phone ?? '',
                      avatar: row.avatar ?? '',
                      skills: row.skills,
                      status: row.status,
                      activityCount: row.activityCount,
                      intensity: row.intensity,
                    });
                  }}
                  onDelete={() => {
                    if (window.confirm('Delete this volunteer?')) {
                      deleteVolunteerM.mutate(row.id);
                    }
                  }}
                />
              )}
            />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'teal' | 'red' | 'amber' | 'indigo' | 'emerald';
}) {
  const tones = {
    teal: 'bg-teal-400/10 text-teal-300',
    red: 'bg-red-400/10 text-red-300',
    amber: 'bg-amber-400/10 text-amber-300',
    indigo: 'bg-indigo-400/10 text-indigo-300',
    emerald: 'bg-emerald-400/10 text-emerald-300',
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-2xl font-black leading-none text-white">{value}</div>
          <div className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  count,
  busy,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/60 p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-teal-300">{icon}</span>
          <h2 className="truncate text-lg font-bold text-white">{title}</h2>
          {typeof count === 'number' ? <Badge variant="secondary">{count}</Badge> : null}
        </div>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" /> : null}
      </div>
      {children}
    </section>
  );
}

function ApplicantRow({
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
  const normalized = applicant.status.toUpperCase();

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-4">
        {applicant.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={applicant.photoUrl}
            alt={`${applicant.name} admin application photo`}
            className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-400">
            <UserCheck className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-white">{applicant.name}</h3>
            <Badge variant={statusVariant(applicant.status)}>{applicant.status}</Badge>
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">{applicant.email}</div>
          <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
            <Meta label="NID" value={applicant.nidNumber || 'Not provided'} />
            <Meta label="Phone" value={applicant.phone || 'Not provided'} />
            <Meta
              label="Education"
              value={`${applicant.education || "Bachelor's degree"}${
                applicant.educationField ? `, ${applicant.educationField}` : ''
              }`}
            />
            <Meta label="Applied" value={applicant.createdAt.toLocaleDateString()} />
          </dl>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || normalized === 'ACTIVE'}
          onClick={onApprove}
          className="rounded-lg"
        >
          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy || normalized === 'REJECTED'}
          onClick={onReject}
          className="rounded-lg"
        >
          <X className="mr-2 h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </article>
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
  setForm: (value: AdminCrimeInput) => void;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <LabeledField label="Title">
        <Input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Crime title"
          className="rounded-lg"
        />
      </LabeledField>
      <LabeledField label="Description">
        <textarea
          className="min-h-24 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-teal-400/40"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="What happened?"
        />
      </LabeledField>
      <div className="grid gap-3 sm:grid-cols-3">
        <LabeledField label="Type">
          <Select
            value={form.type}
            onChange={(value) =>
              setForm({ ...form, type: value as CrimeType, category: value as CrimeType })
            }
            options={crimeTypes}
          />
        </LabeledField>
        <LabeledField label="Severity">
          <Select
            value={form.severity}
            onChange={(value) => setForm({ ...form, severity: value as Severity })}
            options={severities}
          />
        </LabeledField>
        <LabeledField label="Status">
          <Input
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            placeholder="Status"
            className="rounded-lg"
          />
        </LabeledField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledField label="Area">
          <Input
            value={form.area ?? ''}
            onChange={(event) => setForm({ ...form, area: event.target.value })}
            placeholder="Area"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="District">
          <Input
            value={form.district ?? ''}
            onChange={(event) => setForm({ ...form, district: event.target.value })}
            placeholder="District"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Division">
          <Input
            value={form.division ?? ''}
            onChange={(event) => setForm({ ...form, division: event.target.value })}
            placeholder="Division"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Reported by">
          <Input
            value={form.reportedBy}
            onChange={(event) => setForm({ ...form, reportedBy: event.target.value })}
            placeholder="Reported by"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Latitude">
          <Input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })}
            placeholder="Latitude"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Longitude">
          <Input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })}
            placeholder="Longitude"
            className="rounded-lg"
          />
        </LabeledField>
      </div>
      <LabeledField label="Address">
        <Input
          value={form.address ?? ''}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
          placeholder="Address"
          className="rounded-lg"
        />
      </LabeledField>
      <FormActions saving={saving} editing={Boolean(form.id)} onCancel={onCancel} />
    </form>
  );
}

function CrimeRow({
  crime,
  deleting,
  onEdit,
  onDelete,
}: {
  crime: Crime;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-white">{crime.title}</h3>
          <Badge variant={severityVariant(crime.severity)}>{crime.severity}</Badge>
          <Badge variant={statusVariant(crime.status)}>{crime.status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>{crime.location.area || crime.location.district || 'Unknown area'}</span>
          <span>{crime.type}</span>
          <span>{new Date(crime.dateTime).toLocaleString()}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onEdit} className="rounded-lg">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </article>
  );
}

function SosRow({
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
    <article className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">
              {alert.message || 'Emergency assistance requested'}
            </h3>
            <Badge variant={alert.status === SOSStatus.ACTIVE ? 'destructive' : 'success'}>
              {alert.status}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>
              {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)}
            </span>
            {alert.location.address ? <span>{alert.location.address}</span> : null}
            <span>{alert.createdAt.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sosStatuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === alert.status ? 'secondary' : 'outline'}
              onClick={() => onStatus(status)}
              disabled={busy || status === alert.status}
              className="rounded-lg"
            >
              {status === SOSStatus.ACTIVE ? (
                <Activity className="mr-2 h-3.5 w-3.5" />
              ) : (
                <Clock3 className="mr-2 h-3.5 w-3.5" />
              )}
              {status}
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}

function CriminalForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  editing,
}: {
  form: Omit<CriminalRecordInput, 'id'>;
  setForm: (value: Omit<CriminalRecordInput, 'id'>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}) {
  return (
    <form
      className="mb-5 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledField label="Name">
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Name"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Status">
          <Input
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            placeholder="Status"
            className="rounded-lg"
          />
        </LabeledField>
      </div>
      <LabeledField label="Description">
        <textarea
          className="min-h-20 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-teal-400/40"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Description"
        />
      </LabeledField>
      <div className="grid gap-3 sm:grid-cols-3">
        <LabeledField label="Frequency">
          <Input
            type="number"
            min={0}
            value={form.crimeCount}
            onChange={(event) => setForm({ ...form, crimeCount: Number(event.target.value) })}
            placeholder="Frequency"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Intensity">
          <Input
            type="number"
            min={0}
            step="0.1"
            value={form.intensity}
            onChange={(event) => setForm({ ...form, intensity: Number(event.target.value) })}
            placeholder="Intensity"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Frequent crime">
          <Select
            value={form.mostFrequentCrime}
            onChange={(value) => setForm({ ...form, mostFrequentCrime: value as CrimeType })}
            options={crimeTypes}
          />
        </LabeledField>
      </div>
      <LabeledField label="Aliases">
        <Input
          value={form.knownAliases.join(', ')}
          onChange={(event) => setForm({ ...form, knownAliases: splitCsv(event.target.value) })}
          placeholder="Aliases, comma separated"
          className="rounded-lg"
        />
      </LabeledField>
      <FormActions saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

function VolunteerForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  saving,
  editing,
}: {
  form: Omit<VolunteerInput, 'id'>;
  setForm: (value: Omit<VolunteerInput, 'id'>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}) {
  return (
    <form
      className="mb-5 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <LabeledField label="Name">
        <Input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Volunteer name"
          className="rounded-lg"
        />
      </LabeledField>
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledField label="Email">
          <Input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="Email"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Phone">
          <Input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            inputMode="numeric"
            maxLength={14}
            placeholder="01712345678"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Activities">
          <Input
            type="number"
            min={0}
            value={form.activityCount}
            onChange={(event) => setForm({ ...form, activityCount: Number(event.target.value) })}
            placeholder="Activity frequency"
            className="rounded-lg"
          />
        </LabeledField>
        <LabeledField label="Impact">
          <Input
            type="number"
            min={0}
            step="0.1"
            value={form.intensity}
            onChange={(event) => setForm({ ...form, intensity: Number(event.target.value) })}
            placeholder="Impact intensity"
            className="rounded-lg"
          />
        </LabeledField>
      </div>
      <LabeledField label="Skills">
        <Input
          value={form.skills.join(', ')}
          onChange={(event) => setForm({ ...form, skills: splitCsv(event.target.value) })}
          placeholder="Skills, comma separated"
          className="rounded-lg"
        />
      </LabeledField>
      <p className="text-xs text-slate-500">{PHONE_HINT}</p>
      <FormActions saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

function RecordList<T>({
  rows,
  render,
  loading,
  emptyText,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
  loading: boolean;
  emptyText: string;
}) {
  return (
    <div className="max-h-[430px] space-y-2 overflow-auto pr-1">
      {loading ? <LoadingRow /> : null}
      {rows.length ? rows.map(render) : !loading ? <Empty text={emptyText} /> : null}
    </div>
  );
}

function RankRow({
  title,
  subtitle,
  status,
  score,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  status: string;
  score: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-white">{title}</h3>
          <Badge variant={statusVariant(status)}>{status}</Badge>
        </div>
        <div className="mt-1 truncate text-xs text-slate-400">{subtitle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="min-w-12 text-right">
          <div className="font-mono font-bold text-teal-300">{Math.round(score)}</div>
          <div className="text-[10px] text-slate-500">SCORE</div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          aria-label="Edit"
          className="rounded-lg"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          aria-label="Delete"
          className="rounded-lg"
        >
          <Trash2 className="h-4 w-4 text-red-300" />
        </Button>
      </div>
    </article>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      className="h-12 w-full rounded-lg border border-white/15 bg-slate-950 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-teal-400/40"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-200">{value}</dd>
    </div>
  );
}

function FormActions({
  saving,
  editing,
  onCancel,
}: {
  saving: boolean;
  editing: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button type="submit" disabled={saving} className="rounded-lg">
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        {editing ? 'Update' : 'Add'}
      </Button>
      {editing ? (
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-lg">
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
