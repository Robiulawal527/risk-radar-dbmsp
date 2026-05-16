'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, LocateFixed, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { fetchCrimesForMapFromSupabase } from '@/lib/map-crimes';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { nominatimSearchBangladesh } from '@/lib/nominatim-client';
import { CrimeType, Severity, type Crime } from '@/lib/types';

const NEARBY_RADIUS_KM = Number(process.env.NEXT_PUBLIC_NEARBY_ALERT_RADIUS_KM ?? '10') || 10;
const BANGLADESH_CENTER = { latitude: 23.685, longitude: 90.3563 };
const severityColors: Record<Severity, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};
const categoryColors = ['#22d3ee', '#a3e635', '#facc15', '#fb7185', '#c084fc', '#38bdf8', '#34d399', '#f97316'];

type Context = {
  label: string;
  latitude: number;
  longitude: number;
  district?: string;
  division?: string;
  source: 'gps' | 'search' | 'fallback';
};

type Scope = {
  title: string;
  subtitle: string;
  total: number;
  topCategory: string;
  categoryRows: Array<{ name: string; value: number; color: string }>;
  severityRows: Array<{ name: Severity; value: number; color: string }>;
};

function crimesFromApiPayload(payload: unknown): Crime[] {
  if (Array.isArray(payload)) return payload as Crime[];
  if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as { items: unknown }).items)) {
    return (payload as { items: Crime[] }).items;
  }
  return [];
}

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizePlace(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ')
    .replace(/\bdivision\b/g, '')
    .replace(/\bdistrict\b/g, '')
    .replace(/\bmetropolitan\b/g, '')
    .replace(/\brange\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^comilla$/, 'cumilla');
}

function samePlace(a?: string, b?: string) {
  if (!a || !b) return false;
  return normalizePlace(a) === normalizePlace(b);
}

function containsPlace(value: string | undefined, query: string) {
  const v = normalizePlace(value);
  const q = normalizePlace(query);
  return Boolean(v && q) && (v.includes(q) || q.includes(v));
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.asin(Math.sqrt(h));
}

function filterBySearch(crimes: Crime[], query: string) {
  return crimes.filter((crime) =>
    [crime.location.division, crime.location.district, crime.location.area, crime.location.address, crime.title, crime.description].some((v) =>
      containsPlace(v, query)
    )
  );
}

function contextFromReports(query: string, crimes: Crime[]): Context | null {
  const matches = filterBySearch(crimes, query);
  if (!matches.length) return null;
  const anchor =
    matches.find((c) => samePlace(c.location.district, query)) ??
    matches.find((c) => samePlace(c.location.division, query)) ??
    matches.find((c) => samePlace(c.location.area, query)) ??
    matches[0]!;
  const positioned = matches.filter((c) => Number.isFinite(c.location.latitude) && Number.isFinite(c.location.longitude));
  const centerRows = positioned.length ? positioned : [anchor];
  return {
    source: 'search',
    label: anchor.location.district || anchor.location.division || anchor.location.area || query,
    latitude: centerRows.reduce((sum, c) => sum + c.location.latitude, 0) / centerRows.length,
    longitude: centerRows.reduce((sum, c) => sum + c.location.longitude, 0) / centerRows.length,
    district: anchor.location.district,
    division: anchor.location.division,
  };
}

function buildScope(title: string, subtitle: string, crimes: Crime[]): Scope {
  const categories = new Map<string, number>();
  const severities = new Map<Severity, number>();
  for (const type of Object.values(CrimeType)) categories.set(type, 0);
  for (const severity of Object.values(Severity)) severities.set(severity, 0);
  for (const crime of crimes) {
    categories.set(crime.type, (categories.get(crime.type) ?? 0) + 1);
    severities.set(crime.severity, (severities.get(crime.severity) ?? 0) + 1);
  }
  const categoryRows = Array.from(categories.entries())
    .map(([name, value], index) => ({ name, value, color: categoryColors[index % categoryColors.length] }))
    .sort((a, b) => b.value - a.value);
  const severityRows = Array.from(severities.entries()).map(([name, value]) => ({ name, value, color: severityColors[name] }));
  const top = categoryRows.find((row) => row.value > 0);
  return { title, subtitle, total: crimes.length, topCategory: top ? label(top.name) : 'No reports', categoryRows, severityRows };
}

export default function AnalyticsPage() {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState<Context>({ source: 'fallback', label: 'Bangladesh', ...BANGLADESH_CENTER });

  const { data: crimes = [], isLoading, isError } = useQuery<Crime[]>({
    queryKey: ['analytics-crimes', isSupabaseConfigured() ? 'supabase' : 'api'],
    queryFn: async () => {
      if (isSupabaseConfigured()) {
        try {
          return await fetchCrimesForMapFromSupabase(5000);
        } catch {
          const res = await api.get('/crimes?limit=5000');
          return crimesFromApiPayload(res.data?.data);
        }
      }
      const res = await api.get('/crimes?limit=5000');
      return crimesFromApiPayload(res.data?.data);
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not available in this browser.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setQuery('');
        setSearchedQuery('');
        setContext({ source: 'gps', label: 'Current location', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setBusy(false);
      },
      () => {
        toast.error('Could not read your location.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    );
  };

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchedQuery('');
      return;
    }
    setBusy(true);
    try {
      const dataContext = contextFromReports(q, crimes);
      if (dataContext) {
        setSearchedQuery(q);
        setContext(dataContext);
        toast.success('Analytics updated', { description: `Using submitted reports for ${dataContext.label}.` });
        return;
      }
      const hits = await nominatimSearchBangladesh(q);
      const first = hits[0];
      if (!first) {
        toast.error('No report or Bangladesh map match found.');
        return;
      }
      setSearchedQuery(q);
      setContext({
        source: 'search',
        label: first.displayName.split(',')[0] || q,
        latitude: first.lat,
        longitude: first.lng,
      });
    } finally {
      setBusy(false);
    }
  };

  const scopes = useMemo(() => {
    const fallbackRows = searchedQuery ? filterBySearch(crimes, searchedQuery) : [];
    const divisionRows = context.division ? crimes.filter((c) => samePlace(c.location.division, context.division)) : [];
    const districtRows = context.district ? crimes.filter((c) => samePlace(c.location.district, context.district)) : [];
    const nearbyRows = crimes.filter((c) => distanceKm(context, c.location) <= NEARBY_RADIUS_KM);
    return {
      division: buildScope('Division', context.division ? `${context.division} division` : 'Search or GPS context', divisionRows.length ? divisionRows : fallbackRows),
      district: buildScope('District', context.district ? `${context.district} district` : 'Search or GPS context', districtRows.length ? districtRows : fallbackRows),
      nearby: buildScope('Nearby', `${NEARBY_RADIUS_KM} km around ${context.source === 'search' ? 'searched place' : 'you'}`, nearbyRows),
    };
  }, [context, crimes, searchedQuery]);

  const maxNearby = Math.max(1, ...scopes.nearby.categoryRows.map((r) => r.value));
  const maxDistrict = Math.max(1, ...scopes.district.categoryRows.map((r) => r.value));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-teal-500/10 p-3">
            <Radio className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Local Analytics</h1>
            <p className="text-slate-400">Bangladesh-only reports by division, district, and nearby radius.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-[560px]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch();
            }}
            placeholder="Search Cumilla, Dhaka, Sylhet..."
          />
          <Button onClick={() => void runSearch()} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
          <Button variant="outline" className="gap-2 border-white/20" onClick={useCurrentLocation} disabled={busy}>
            <LocateFixed className="h-4 w-4" />
            GPS
          </Button>
        </div>
      </div>

      {isError ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">Could not load analytics data.</div> : null}
      {isLoading ? <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics...</div> : null}

      <Card className="glass-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">Analytics context</div>
            <div className="mt-1 text-2xl font-black text-white">{context.label}</div>
            <div className="text-sm text-slate-400">{[context.district, context.division].filter(Boolean).join(' • ') || 'Bangladesh context'}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <Mini label="Nearby reports" value={String(scopes.nearby.total)} />
            <Mini label="Top nearby" value={scopes.nearby.topCategory} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ScopeCard scope={scopes.division} tone="cyan" />
        <ScopeCard scope={scopes.district} tone="lime" />
        <ScopeCard scope={scopes.nearby} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-panel">
          <h2 className="text-2xl font-bold">Nearby category mix</h2>
          <p className="mb-6 text-sm text-slate-400">{scopes.nearby.total} reports inside {NEARBY_RADIUS_KM} km</p>
          <div className="space-y-4">
            {scopes.nearby.categoryRows.slice(0, 7).map((row) => (
              <BarRow key={row.name} label={label(row.name)} value={row.value} max={maxNearby} color={row.color} />
            ))}
          </div>
        </Card>

        <Card className="glass-panel">
          <h2 className="text-2xl font-bold">Nearby severity</h2>
          <p className="mb-6 text-sm text-slate-400">Operational urgency around the selected point</p>
          <div className="grid grid-cols-2 gap-3">
            {scopes.nearby.severityRows.map((row) => (
              <div key={row.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                <div className="text-xs font-bold text-slate-400">{row.name}</div>
                <div className="mt-1 text-3xl font-black">{row.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="glass-panel">
        <h2 className="text-2xl font-bold">District categories</h2>
        <p className="mb-6 text-sm text-slate-400">{scopes.district.subtitle}</p>
        <div className="space-y-4">
          {scopes.district.categoryRows.slice(0, 7).map((row) => (
            <BarRow key={row.name} label={label(row.name)} value={row.value} max={maxDistrict} color={row.color} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xl font-black text-teal-300">{value}</div>
    </div>
  );
}

function ScopeCard({ scope, tone }: { scope: Scope; tone: 'cyan' | 'lime' | 'rose' }) {
  const color = tone === 'cyan' ? 'text-cyan-300' : tone === 'lime' ? 'text-lime-300' : 'text-rose-300';
  return (
    <Card className="glass-panel min-h-[190px]">
      <div className={`text-sm font-black ${color}`}>{scope.title}</div>
      <div className="mt-1 min-h-10 text-sm text-slate-400">{scope.subtitle}</div>
      <div className="mt-4 text-5xl font-black tracking-tight">{scope.total.toLocaleString()}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">reports</div>
      <div className={`mt-4 truncate text-sm font-black ${color}`}>{scope.topCategory}</div>
    </Card>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between gap-4 text-sm">
        <span className="truncate font-semibold text-white">{label}</span>
        <span className="font-mono text-slate-400">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
