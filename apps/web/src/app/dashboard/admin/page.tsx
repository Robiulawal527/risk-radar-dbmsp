'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
  AlertTriangle,
  CheckCircle2,
  Gavel,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { PHONE_HINT, requireValidPhoneNumber } from '@/lib/validation';

const crimeTypes = Object.values(CrimeType);
const severities = Object.values(Severity);
const sosStatuses = Object.values(SOSStatus);

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

export default function AdminPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
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

  const stats = useMemo(() => {
    const crimes = crimesQ.data ?? [];
    const sos = sosQ.data ?? [];
    return {
      crimes: crimes.length,
      critical: crimes.filter((crime) => crime.severity === Severity.CRITICAL).length,
      activeSos: sos.filter((alert) => alert.status === SOSStatus.ACTIVE).length,
      volunteers: volunteersQ.data?.length ?? 0,
      pendingAdmins:
        applicantsQ.data?.filter((applicant) => applicant.status.toUpperCase() === 'PENDING')
          .length ?? 0,
    };
  }, [applicantsQ.data, crimesQ.data, sosQ.data, volunteersQ.data]);

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

  const saveCrimeM = useMutation({
    mutationFn: saveAdminCrime,
    onSuccess: async () => {
      toast.success(crimeForm.id ? 'Crime report updated' : 'Crime report added');
      setCrimeForm(emptyCrime);
      await refreshAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not save crime report'),
  });

  const deleteCrimeM = useMutation({
    mutationFn: deleteAdminCrime,
    onSuccess: async () => {
      toast.success('Crime report deleted');
      await refreshAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not delete crime report'),
  });

  const saveCriminalM = useMutation({
    mutationFn: saveCriminalRecord,
    onSuccess: async () => {
      toast.success(criminalEditId ? 'Criminal record updated' : 'Criminal record added');
      setCriminalEditId(undefined);
      setCriminalForm({ ...emptyCriminal });
      await refreshAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not save criminal record'),
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
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save volunteer'),
  });

  const updateSosM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SOSStatus }) =>
      updateAdminSosStatus(id, status),
    onSuccess: async () => {
      toast.success('SOS status updated');
      await refreshAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not update SOS status'),
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
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not update admin application'),
  });

  if (!isAdmin) {
    return (
      <Card className="glass-panel mx-auto max-w-2xl border-amber-500/30 bg-amber-500/10">
        <div className="flex gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-300" />
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
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 border-teal-500/40 text-teal-200">
            Admin command
          </Badge>
          <h1 className="text-4xl font-black tracking-tighter sm:text-5xl">Operations dashboard</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Manage crime reports, verified criminal records, SOS review, volunteers, and public
            rankings from one place.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refreshAll}
          className="border-white/20 bg-white/5"
        >
          Refresh data
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={<AlertTriangle />} label="Reports" value={stats.crimes} />
        <Stat icon={<Gavel />} label="Critical" value={stats.critical} />
        <Stat icon={<ShieldAlert />} label="Active SOS" value={stats.activeSos} />
        <Stat icon={<UserCheck />} label="Pending admins" value={stats.pendingAdmins} />
      </div>

      <Card className="glass-panel border-amber-300/20">
        <SectionTitle icon={<UserCheck />} title="Admin applications" />
        <div className="grid gap-3 lg:grid-cols-2">
          {applicantsQ.isLoading ? <LoadingRow /> : null}
          {(applicantsQ.data ?? []).map((applicant) => (
            <div
              key={applicant.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start gap-4">
                {applicant.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={applicant.photoUrl}
                    alt={`${applicant.name} admin application photo`}
                    className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-slate-400">
                    <UserCheck className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{applicant.name}</div>
                    <Badge
                      variant={
                        applicant.status.toUpperCase() === 'ACTIVE'
                          ? 'success'
                          : applicant.status.toUpperCase() === 'REJECTED'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {applicant.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{applicant.email}</div>
                  <div className="mt-3 grid gap-1 text-xs text-slate-300">
                    <div>NID: {applicant.nidNumber || 'Not provided'}</div>
                    <div>
                      Education: {applicant.education || "Bachelor's degree"}
                      {applicant.educationField ? `, ${applicant.educationField}` : ''}
                    </div>
                    {applicant.phone ? <div>Phone: {applicant.phone}</div> : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={reviewAdminM.isPending || applicant.status.toUpperCase() === 'ACTIVE'}
                  onClick={() => reviewAdminM.mutate({ applicant, status: 'ACTIVE' })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reviewAdminM.isPending || applicant.status.toUpperCase() === 'REJECTED'}
                  onClick={() => reviewAdminM.mutate({ applicant, status: 'REJECTED' })}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
          {!applicantsQ.isLoading && !applicantsQ.data?.length ? (
            <Empty text="No admin applications yet." />
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass-panel">
          <SectionTitle
            icon={<Plus />}
            title={crimeForm.id ? 'Update crime report' : 'Add crime report'}
          />
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!crimeForm.title.trim() || !crimeForm.description.trim())
                return toast.error('Title and description are required.');
              if (!Number.isFinite(crimeForm.latitude) || !Number.isFinite(crimeForm.longitude))
                return toast.error('Valid coordinates are required.');
              saveCrimeM.mutate(crimeForm);
            }}
          >
            <Input
              value={crimeForm.title}
              onChange={(e) => setCrimeForm({ ...crimeForm, title: e.target.value })}
              placeholder="Crime title"
            />
            <textarea
              className="min-h-24 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/40"
              value={crimeForm.description}
              onChange={(e) => setCrimeForm({ ...crimeForm, description: e.target.value })}
              placeholder="What happened?"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                value={crimeForm.type}
                onChange={(value) =>
                  setCrimeForm({
                    ...crimeForm,
                    type: value as CrimeType,
                    category: value as CrimeType,
                  })
                }
                options={crimeTypes}
              />
              <Select
                value={crimeForm.severity}
                onChange={(value) => setCrimeForm({ ...crimeForm, severity: value as Severity })}
                options={severities}
              />
              <Input
                value={crimeForm.status}
                onChange={(e) => setCrimeForm({ ...crimeForm, status: e.target.value })}
                placeholder="Status"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={crimeForm.area ?? ''}
                onChange={(e) => setCrimeForm({ ...crimeForm, area: e.target.value })}
                placeholder="Area"
              />
              <Input
                value={crimeForm.district ?? ''}
                onChange={(e) => setCrimeForm({ ...crimeForm, district: e.target.value })}
                placeholder="District"
              />
              <Input
                value={crimeForm.division ?? ''}
                onChange={(e) => setCrimeForm({ ...crimeForm, division: e.target.value })}
                placeholder="Division"
              />
              <Input
                value={crimeForm.reportedBy}
                onChange={(e) => setCrimeForm({ ...crimeForm, reportedBy: e.target.value })}
                placeholder="Reported by"
              />
              <Input
                type="number"
                step="any"
                value={crimeForm.latitude}
                onChange={(e) => setCrimeForm({ ...crimeForm, latitude: Number(e.target.value) })}
                placeholder="Latitude"
              />
              <Input
                type="number"
                step="any"
                value={crimeForm.longitude}
                onChange={(e) => setCrimeForm({ ...crimeForm, longitude: Number(e.target.value) })}
                placeholder="Longitude"
              />
            </div>
            <Input
              value={crimeForm.address ?? ''}
              onChange={(e) => setCrimeForm({ ...crimeForm, address: e.target.value })}
              placeholder="Address"
            />
            <FormActions
              saving={saveCrimeM.isPending}
              editing={Boolean(crimeForm.id)}
              onCancel={() => setCrimeForm(emptyCrime)}
            />
          </form>
        </Card>

        <Card className="glass-panel">
          <SectionTitle icon={<ShieldAlert />} title="Review SOS reports" />
          <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
            {sosQ.isLoading ? <LoadingRow /> : null}
            {sosQ.data?.map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {alert.message || 'Emergency assistance requested'}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {alert.location.latitude.toFixed(5)}, {alert.location.longitude.toFixed(5)} •{' '}
                      {new Date(alert.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant={alert.status === SOSStatus.ACTIVE ? 'destructive' : 'success'}>
                    {alert.status}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  {sosStatuses.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === alert.status ? 'secondary' : 'outline'}
                      onClick={() => updateSosM.mutate({ id: alert.id, status })}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {!sosQ.isLoading && !sosQ.data?.length ? <Empty text="No SOS reports found." /> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass-panel">
          <SectionTitle icon={<Gavel />} title="Criminal records and ranking" />
          <RecordForm
            kind="criminal"
            form={criminalForm}
            setForm={setCriminalForm}
            saving={saveCriminalM.isPending}
            editing={Boolean(criminalEditId)}
            onCancel={() => {
              setCriminalEditId(undefined);
              setCriminalForm({ ...emptyCriminal });
            }}
            onSubmit={() => saveCriminalM.mutate({ ...criminalForm, id: criminalEditId })}
          />
          <RecordList
            rows={criminalsQ.data ?? []}
            render={(row: AdminCriminalRecord) => (
              <RankRow
                key={row.id}
                title={row.name}
                subtitle={`${row.crimeCount} incidents • ${row.intensity} intensity • ${row.mostFrequentCrime}`}
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
                onDelete={() =>
                  deleteCriminalRecord(row.id)
                    .then(refreshAll)
                    .then(() => toast.success('Criminal record deleted'))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Delete failed')
                    )
                }
              />
            )}
          />
        </Card>

        <Card className="glass-panel">
          <SectionTitle icon={<Users />} title="Volunteers and ranking" />
          <VolunteerForm
            form={volunteerForm}
            setForm={setVolunteerForm}
            saving={saveVolunteerM.isPending}
            editing={Boolean(volunteerEditId)}
            onCancel={() => {
              setVolunteerEditId(undefined);
              setVolunteerForm({ ...emptyVolunteer });
            }}
            onSubmit={() => saveVolunteerM.mutate({ ...volunteerForm, id: volunteerEditId })}
          />
          <RecordList
            rows={volunteersQ.data ?? []}
            render={(row: AdminVolunteer) => (
              <RankRow
                key={row.id}
                title={row.name}
                subtitle={`${row.activityCount} activities • ${row.intensity} intensity • ${row.status}`}
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
                onDelete={() =>
                  deleteVolunteer(row.id)
                    .then(refreshAll)
                    .then(() => toast.success('Volunteer deleted'))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Delete failed')
                    )
                }
              />
            )}
          />
        </Card>
      </div>

      <Card className="glass-panel">
        <SectionTitle icon={<AlertTriangle />} title="Crime report management" />
        <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
          {crimesQ.isLoading ? <LoadingRow /> : null}
          {crimesQ.data?.map((crime) => (
            <div
              key={crime.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-semibold">{crime.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {crime.location.area || crime.location.district || 'Unknown area'} • {crime.type}{' '}
                  • {crime.severity}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCrimeForm(crimeToInput(crime))}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('Delete this crime report?')) deleteCrimeM.mutate(crime.id);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!crimesQ.isLoading && !crimesQ.data?.length ? (
            <Empty text="No crime reports found." />
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="glass-panel rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-teal-400/10 p-2 text-teal-300">{icon}</div>
        <div>
          <div className="text-2xl font-black">{value}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
      <span className="text-teal-300">{icon}</span>
      {title}
    </div>
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
      className="h-12 rounded-2xl border border-white/15 bg-slate-950 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-teal-400/40"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Select option for ${value}`}
      title={`Select option (current: ${value})`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
    <div className="flex gap-2">
      <Button type="submit" disabled={saving}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        {editing ? 'Update' : 'Add'}
      </Button>
      {editing ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function RecordForm({ form, setForm, onSubmit, onCancel, saving, editing }: any) {
  return (
    <form
      className="mb-5 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Name"
      />
      <textarea
        className="min-h-20 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/40"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Description"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          type="number"
          value={form.crimeCount}
          onChange={(e) => setForm({ ...form, crimeCount: Number(e.target.value) })}
          placeholder="Frequency"
        />
        <Input
          type="number"
          step="0.1"
          value={form.intensity}
          onChange={(e) => setForm({ ...form, intensity: Number(e.target.value) })}
          placeholder="Intensity"
        />
        <Select
          value={form.mostFrequentCrime}
          onChange={(value) => setForm({ ...form, mostFrequentCrime: value as CrimeType })}
          options={crimeTypes}
        />
      </div>
      <Input
        value={form.knownAliases.join(', ')}
        onChange={(e) => setForm({ ...form, knownAliases: splitCsv(e.target.value) })}
        placeholder="Aliases, comma separated"
      />
      <FormActions saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

function VolunteerForm({ form, setForm, onSubmit, onCancel, saving, editing }: any) {
  return (
    <form
      className="mb-5 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Volunteer name"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
        />
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          inputMode="numeric"
          maxLength={14}
          placeholder="01712345678"
        />
        <Input
          type="number"
          value={form.activityCount}
          onChange={(e) => setForm({ ...form, activityCount: Number(e.target.value) })}
          placeholder="Activity frequency"
        />
        <Input
          type="number"
          step="0.1"
          value={form.intensity}
          onChange={(e) => setForm({ ...form, intensity: Number(e.target.value) })}
          placeholder="Impact intensity"
        />
      </div>
      <Input
        value={form.skills.join(', ')}
        onChange={(e) => setForm({ ...form, skills: splitCsv(e.target.value) })}
        placeholder="Skills, comma separated"
      />
      <p className="text-xs text-slate-500">
        Phone is optional, but when present it must be 11 digits. {PHONE_HINT}
      </p>
      <FormActions saving={saving} editing={editing} onCancel={onCancel} />
    </form>
  );
}

function RecordList<T>({ rows, render }: { rows: T[]; render: (row: T) => React.ReactNode }) {
  return (
    <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
      {rows.length ? rows.map(render) : <Empty text="No rows yet." />}
    </div>
  );
}

function RankRow({
  title,
  subtitle,
  score,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  score: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="min-w-0">
        <div className="truncate font-semibold">{title}</div>
        <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <div className="font-mono font-bold text-teal-300">{Math.round(score)}</div>
          <div className="text-[10px] text-slate-500">SCORE</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => window.confirm('Delete this row?') && onDelete()}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4 text-red-300" />
        </Button>
      </div>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}
