'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import type { CrimeMapHandle, CrimeMapProps } from '@/components/CrimeMap';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { fetchCrimesForMapFromSupabase } from '@/lib/map-crimes';
import { latLngSquareBoundsKm2 } from '@/lib/map-square-bounds';
import { fetchActiveSosAlertsFromSupabase } from '@/lib/sos-alerts';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { nominatimSearchBangladesh } from '@/lib/nominatim-client';
import type { Crime } from '@/lib/types';
import { Severity } from '@/lib/types';
import { AlertTriangle, Loader2, RefreshCw, Search, X, BellRing, Radio } from 'lucide-react';

type DynamicCrimeMapProps = CrimeMapProps & {
  forwardedRef?: Ref<CrimeMapHandle>;
};

const CrimeMap = dynamic<DynamicCrimeMapProps>(
  () =>
    import('@/components/CrimeMap').then((mod) => {
      const CrimeMapComponent = mod.default;
      function DynamicCrimeMap({ forwardedRef, ...props }: DynamicCrimeMapProps) {
        return <CrimeMapComponent {...props} ref={forwardedRef} />;
      }
      return DynamicCrimeMap;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[400px] w-full rounded-3xl bg-white/5 animate-pulse" />
    ),
  }
);

/** Debounce placename lookups to comply with courteous Nominatim usage (~1 req/sec). */
const GEOCODE_DEBOUNCE_MS = 450;

type GeocodeMode = 'manual' | 'auto';

type SearchScope = {
  query: string;
  label: string;
  bounds: [[number, number], [number, number]];
};

type PendingGeocodeResult = {
  hits: Awaited<ReturnType<typeof nominatimSearchBangladesh>>;
  queryTrimmed: string;
};

function crimesFromApiPayload(payload: unknown): Crime[] {
  if (Array.isArray(payload)) return payload as Crime[];
  if (
    payload &&
    typeof payload === 'object' &&
    'items' in payload &&
    Array.isArray((payload as { items: unknown }).items)
  ) {
    return (payload as { items: Crime[] }).items;
  }
  return [];
}

function severityLabel(s: Crime['severity']): string {
  return String(s);
}

function crimeIsInsideBounds(crime: Crime, bounds: SearchScope['bounds']): boolean {
  const [[south, west], [north, east]] = bounds;
  const { latitude, longitude } = crime.location;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

function compactPlaceName(displayName: string, fallback: string): string {
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, 3).join(', ') || fallback;
}

export default function MapPage() {
  const [searchText, setSearchText] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope | null>(null);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geoHint, setGeoHint] = useState<string | null>(null);

  const crimeMapRef = useRef<CrimeMapHandle | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const pendingGeocodeRef = useRef<PendingGeocodeResult | null>(null);
  const dataSource = isSupabaseConfigured() ? 'supabase' : 'api';

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['map-crimes', dataSource],
    queryFn: async () => {
      if (isSupabaseConfigured()) {
        return await fetchCrimesForMapFromSupabase(2000);
      }
      const res = await api.get('/crimes?limit=2000');
      return crimesFromApiPayload(res.data?.data);
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const {
    data: activeSosAlerts = [],
    isError: sosError,
    refetch: refetchSos,
  } = useQuery({
    queryKey: ['active-sos-alerts'],
    enabled: isSupabaseConfigured(),
    queryFn: () => fetchActiveSosAlertsFromSupabase(200),
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: 2,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel('web-live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crimes' }, () => {
        void refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        void refetchSos();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, refetchSos]);

  const supabaseToastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!isError || !error) {
      supabaseToastKey.current = null;
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (supabaseToastKey.current === msg) return;
    supabaseToastKey.current = msg;
    toast.error('Could not load incidents from Supabase', {
      description: msg,
      duration: 8000,
    });
  }, [isError, error]);

  const crimes = useMemo(() => data ?? [], [data]);
  const filteredCrimes = useMemo(() => {
    if (!searchScope) return crimes;
    return crimes.filter((crime) => crimeIsInsideBounds(crime, searchScope.bounds));
  }, [crimes, searchScope]);

  const highRisk = useMemo(
    () =>
      filteredCrimes.filter((c) => c.severity === Severity.HIGH || c.severity === Severity.CRITICAL)
        .length,
    [filteredCrimes]
  );

  const highPriorityList = useMemo(
    () =>
      filteredCrimes
        .filter((c) => c.severity === Severity.HIGH || c.severity === Severity.CRITICAL)
        .slice(0, 5),
    [filteredCrimes]
  );

  const applyHitsToMap = useCallback(
    (hits: Awaited<ReturnType<typeof nominatimSearchBangladesh>>, queryTrimmed: string) => {
      const mapApi = crimeMapRef.current;
      if (!hits.length) return false;
      if (!mapApi) {
        pendingGeocodeRef.current = { hits, queryTrimmed };
        setGeoHint('Map is loading. Search will apply automatically.');
        return true;
      }
      const first = hits[0]!;
      const bounds = latLngSquareBoundsKm2(first.lat, first.lng, 10);
      mapApi.focusSquareKm2(first.lat, first.lng, 10);
      pendingGeocodeRef.current = null;
      setSearchScope({
        query: queryTrimmed,
        label: compactPlaceName(first.displayName, queryTrimmed),
        bounds,
      });
      setGeoHint(null);
      return true;
    },
    []
  );

  const handleMapReady = useCallback(() => {
    const pending = pendingGeocodeRef.current;
    if (!pending) return;
    applyHitsToMap(pending.hits, pending.queryTrimmed);
  }, [applyHitsToMap]);

  const geocodeBangladeshPlace = useCallback(
    async (raw: string, mode: GeocodeMode) => {
      const q = raw.trim();
      if (q.length < 2) {
        setGeoHint(null);
        if (mode === 'manual') {
          toast.error('Type at least 2 characters.', { duration: 4000 });
        }
        return false;
      }

      geocodeAbortRef.current?.abort();
      const ac = new AbortController();
      geocodeAbortRef.current = ac;

      setGeocodeBusy(true);
      setGeoHint(null);

      try {
        const hits = await nominatimSearchBangladesh(q, ac.signal);
        const ok = applyHitsToMap(hits, q);
        if (!ok) {
          if (hits.length === 0) {
            const msg = 'No Bangladesh place matched.';
            setGeoHint(msg);
            if (mode === 'manual') {
              toast.message('Nothing found here', {
                description: `Try spelling the Upazila, district, or area.`,
                duration: 5500,
              });
            }
          }
        } else if (mode === 'manual') {
          const top = hits[0];
          if (top) {
            toast.success('Showing place', {
              description:
                top.displayName.length > 140
                  ? `${top.displayName.slice(0, 140)}…`
                  : top.displayName,
              duration: 4500,
            });
          }
        }
        return ok;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return false;
        const msg = error instanceof Error ? error.message : 'Geocoding failed.';
        setGeoHint(msg);
        if (mode === 'manual') {
          toast.error('Place search failed', { description: msg, duration: 7000 });
        }
        return false;
      } finally {
        setGeocodeBusy(false);
      }
    },
    [applyHitsToMap]
  );

  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 3) {
      return;
    }
    const tid = window.setTimeout(() => {
      void geocodeBangladeshPlace(q, 'auto');
    }, GEOCODE_DEBOUNCE_MS);
    return () => window.clearTimeout(tid);
  }, [searchText, geocodeBangladeshPlace]);

  const applySearch = () => {
    void geocodeBangladeshPlace(searchText, 'manual');
  };

  const clearFilter = () => {
    geocodeAbortRef.current?.abort();
    geocodeAbortRef.current = null;
    pendingGeocodeRef.current = null;
    crimeMapRef.current?.clearSearchArea();
    setSearchScope(null);
    setSearchText('');
    setGeoHint(null);
    setGeocodeBusy(false);
  };

  const mapLoading = isPending && !data;
  const showEmptyOverlay = !isPending && !isError && filteredCrimes.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal-500/10 p-3">
              <Radio className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter sm:text-4xl md:text-5xl">
                Live heatmap
              </h1>
              <p className="mt-1 text-base text-slate-400 sm:text-lg md:text-xl">
                Crime intensity and incidents
                {isSupabaseConfigured() ? ' from database' : ' across Dhaka'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="success" className="gap-1.5 px-4 py-1">
            {isFetching && !mapLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            )}
            LIVE
          </Badge>
          <div className="text-slate-400">
            {isError ? (
              <span className="text-amber-400">Data unavailable</span>
            ) : (
              <>
                {filteredCrimes.length}
                {searchScope ? ` in area` : ` incidents`}
                {searchScope ? ` • 10 km² search` : ` • ${highRisk} high risk`}
                {activeSosAlerts.length ? ` • ${activeSosAlerts.length} live SOS` : ''}
              </>
            )}
          </div>
          {isSupabaseConfigured() && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Supabase
            </span>
          )}
        </div>
      </div>

      {isError && (
        <Card className="glass-panel border-red-500/30 bg-red-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
              <div>
                <div className="font-semibold text-red-200">Map data failed to load</div>
                <p className="mt-1 text-sm text-slate-400">
                  {error instanceof Error ? error.message : 'Unknown error'}
                  {isSupabaseConfigured() && (
                    <>
                      {' '}
                      — ensure a table like <code className="text-slate-300">crimes</code> or{' '}
                      <code className="text-slate-300">Crime</code> exists, RLS allows{' '}
                      <code className="text-slate-300">SELECT</code> for the anon key, and
                      optionally set{' '}
                      <code className="text-slate-300">NEXT_PUBLIC_SUPABASE_CRIME_TABLE</code>{' '}
                      (comma-separated fallbacks).
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-white/20 bg-white/5"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {sosError ? (
          <div className="xl:col-span-12 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Could not refresh live SOS alerts. Check RLS/realtime for <code>sos_alerts</code>.
          </div>
        ) : null}
        <div className="space-y-4 xl:col-span-3">
          <Card className="glass-panel rounded-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Search className="h-4 w-4 text-teal-300" aria-hidden />
              Search area
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              Search any Bangladesh place to center the map on a 10 km² safety view.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Narayanganj, Dhanmondi, Sylhet…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
                aria-label="Search for a Bangladesh place to move the map"
              />
              <Button
                type="button"
                onClick={applySearch}
                size="icon"
                disabled={geocodeBusy}
                aria-label="Search place and zoom map"
              >
                {geocodeBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {geoHint ? (
              <p className="mt-2 text-xs text-amber-200/85" role="status">
                {geoHint}
              </p>
            ) : null}
            {geocodeBusy && !geoHint ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Searching map…
              </p>
            ) : null}

            {searchScope ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-teal-100">{searchScope.label}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-teal-200/60">
                    10 km² mapped area
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearFilter}
                  className="shrink-0 rounded-lg p-1 text-teal-100/70 hover:bg-white/10 hover:text-white"
                  aria-label="Clear area filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </Card>

          <Card className="glass-panel rounded-2xl">
            <div className="mb-4 flex items-center gap-2 text-amber-400">
              <BellRing className="h-5 w-5" aria-hidden />
              <div className="font-semibold">High priority</div>
            </div>

            <div className="space-y-3 text-sm">
              {mapLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : highPriorityList.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No high or critical incidents in this area.
                </p>
              ) : (
                highPriorityList.map((crime) => (
                  <div
                    key={crime.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 transition-colors hover:border-amber-500/20"
                  >
                    <div className="font-medium text-white">{crime.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>
                        {crime.location.area ?? crime.location.district ?? 'Location unknown'}
                      </span>
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200/90">
                        {severityLabel(crime.severity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-9">
          <div className="map-container relative h-[min(70vh,700px)] min-h-[420px] overflow-hidden rounded-3xl border border-white/10">
            {mapLoading ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" aria-hidden />
                <p className="text-sm text-slate-400">Loading incidents…</p>
              </div>
            ) : null}

            {showEmptyOverlay ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
                <div className="glass max-w-md rounded-2xl px-6 py-5 text-center shadow-2xl">
                  <p className="text-sm font-medium text-white">No incidents in this view</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {searchScope
                      ? 'Try clearing the search or choosing a nearby place.'
                      : isSupabaseConfigured()
                        ? 'Add rows to the Crime table or relax RLS policies for reads.'
                        : 'Reports will appear here when your API returns data.'}
                  </p>
                </div>
              </div>
            ) : null}

            {!isError ? (
              <CrimeMap
                forwardedRef={crimeMapRef}
                crimes={filteredCrimes}
                sosAlerts={activeSosAlerts}
                showEmptyState={showEmptyOverlay}
                onReady={handleMapReady}
              />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center bg-[#0a1020] text-slate-500">
                Map unavailable — use retry above.
              </div>
            )}

            <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[400] flex flex-wrap items-end justify-between gap-2 sm:pointer-events-auto">
              <div className="glass rounded-2xl px-4 py-2.5 text-[11px] text-slate-300 shadow-lg">
                <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400 align-middle" />
                Tap markers for details · red circles = live SOS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
