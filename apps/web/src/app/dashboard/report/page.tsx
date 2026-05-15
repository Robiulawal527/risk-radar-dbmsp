'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CrimeType, Severity } from '@risk-radar/types';
import { toast } from 'sonner';
import { ShieldAlert, MapPin, Loader2, Navigation, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  nominatimReverseBangladesh,
  nominatimSearchBangladesh,
  type NominatimHit,
} from '@/lib/nominatim-client';

const CRIME_TYPES = Object.values(CrimeType) as CrimeType[];
const SEVERITIES = Object.values(Severity) as Severity[];

function formatCrimeLabel(t: CrimeType) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const severityStyle: Record<Severity, string> = {
  [Severity.LOW]: 'risk-low',
  [Severity.MEDIUM]: 'risk-medium',
  [Severity.HIGH]: 'risk-high',
  [Severity.CRITICAL]: 'risk-critical',
};

const TITLE_MIN = 4;
const DESC_MIN = 20;
const AREA_MIN = 3;

export default function ReportPage() {
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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const titleOk = title.trim().length >= TITLE_MIN;
  const descOk = description.trim().length >= DESC_MIN;
  const areaOk = area.trim().length >= AREA_MIN;

  const coordOk =
    latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const showErrors = touched;
  const titleInvalid = showErrors && !titleOk;
  const descInvalid = showErrors && !descOk;
  const areaInvalid = showErrors && !areaOk;

  const applyPlace = (place: NominatimHit) => {
    setLatitude(place.lat);
    setLongitude(place.lng);
    setAddress(place.address || place.displayName || '');
    if (place.area) setArea(place.area);
    if (place.district) setDistrict(place.district);
    if (place.division) setDivision(place.division);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not available in this browser.');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        try {
          const place = await nominatimReverseBangladesh(pos.coords.latitude, pos.coords.longitude);
          if (place) {
            applyPlace(place);
            toast.success('Location filled from GPS', {
              description: 'Address, area, district, and division were added. You can edit them.',
            });
          } else {
            toast.success('GPS position saved', {
              description: 'Add the address details manually before submitting.',
            });
          }
        } catch (err) {
          toast.success('GPS position saved', {
            description:
              err instanceof Error
                ? `Geocoder did not respond: ${err.message}`
                : 'Add the address details manually before submitting.',
          });
        } finally {
          setLocLoading(false);
        }
      },
      () => {
        setLocLoading(false);
        toast.error('Could not read location', {
          description: 'Allow location access in your browser settings, or type an area manually.',
        });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  };

  const findTypedLocation = async () => {
    const query = [address, area, district, division].filter(Boolean).join(', ');
    if (query.trim().length < 2) {
      toast.error('Type a place first', {
        description: 'Enter an address, area, district, or division to locate it.',
      });
      return;
    }

    setPlaceLoading(true);
    try {
      const results = await nominatimSearchBangladesh(query);
      const place = results[0];
      if (!place) {
        toast.error('No map match found', {
          description: 'Try a nearby landmark or a more specific address.',
        });
        return;
      }
      applyPlace(place);
      toast.success('Location matched', {
        description: 'Coordinates and address fields were filled from the map result.',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not find that location');
    } finally {
      setPlaceLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!titleOk) {
      toast.error('Add a clearer title', {
        description: `Use at least ${TITLE_MIN} characters so others can understand the incident.`,
      });
      return;
    }
    if (!descOk) {
      toast.error('Add more detail', {
        description: `Aim for at least ${DESC_MIN} characters: time, what happened, and anything notable.`,
      });
      return;
    }
    if (!areaOk) {
      toast.error('Location label needed', {
        description: 'Enter a neighborhood or landmark so responders can orient quickly.',
      });
      return;
    }
    if (!coordOk) {
      toast.error('GPS coordinates required', {
        description: 'Tap “Use my location” so the incident can be placed on the map accurately.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/crimes', {
        type,
        category: type,
        title: title.trim(),
        description: description.trim(),
        location: {
          latitude,
          longitude,
          address: address.trim() || undefined,
          area: area.trim(),
          district: district.trim() || undefined,
          division: division.trim() || undefined,
        },
        severity,
        reportedBy: user?.name?.trim() || user?.email || 'Community reporter',
        dateTime: new Date().toISOString(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
        queryClient.invalidateQueries({ queryKey: ['map-crimes'] }),
      ]);
      toast.success('Report submitted', {
        description: 'It is stored in the database. Nearby users with alerts enabled may be notified.',
      });
      setTitle('');
      setDescription('');
      setType(CrimeType.THEFT);
      setSeverity(Severity.MEDIUM);
      setAddress('');
      setArea('');
      setDistrict('');
      setDivision('');
      setLatitude(null);
      setLongitude(null);
      setTouched(false);
    } catch (err: unknown) {
      const responseError =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      const msg = responseError || (err instanceof Error ? err.message : 'Submit failed');
      toast.error(msg || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Badge variant="outline" className="mb-4 border-teal-500/40 text-teal-200">
          Community safety
        </Badge>
        <h1 className="text-4xl font-black tracking-tighter text-white sm:text-5xl">
          Report an incident
        </h1>
        <p className="mt-2 max-w-xl text-lg text-slate-400">
          Share what you saw so neighbors and responders can stay informed. Accurate, timely reports
          matter most.
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="glass-panel border-teal-500/15">
          <div className="mb-8 flex gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="shrink-0 rounded-xl bg-amber-500/15 p-3">
              <Info className="h-5 w-5 text-amber-300" aria-hidden />
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Reports are reviewed by moderators. False or abusive reports may lead to account
              restrictions. Only submit information you believe is true.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8" noValidate>
            <div className="space-y-2">
              <label htmlFor="report-title" className="text-xs font-semibold tracking-wide text-slate-400">
                Short summary
              </label>
              <Input
                id="report-title"
                name="title"
                autoComplete="off"
                placeholder="e.g. Phone snatching near bus stop"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-describedby="report-title-hint"
                className={cn(titleInvalid && 'border-red-400/50 ring-1 ring-red-400/30')}
              />
              <p id="report-title-hint" className="text-xs text-slate-500">
                Minimum {TITLE_MIN} characters. What happened, in one line.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="report-description" className="text-xs font-semibold tracking-wide text-slate-400">
                  What happened?
                </label>
                <span className="text-xs text-slate-500">{description.length} characters</span>
              </div>
              <textarea
                id="report-description"
                name="description"
                className={cn(
                  'glass-field min-h-[160px] w-full resize-y',
                  descInvalid && 'border-red-400/50 ring-1 ring-red-400/30'
                )}
                placeholder="Time of day, people involved, direction they went, vehicle details, and whether anyone needed help…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-describedby="report-description-hint"
              />
              <p id="report-description-hint" className="text-xs text-slate-500">
                At least {DESC_MIN} characters helps responders and the community act on credible
                information.
              </p>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold tracking-wide text-slate-400">
                Crime type
              </legend>
              <div className="flex flex-wrap gap-2">
                {CRIME_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      type === t
                        ? 'border-teal-500/60 bg-teal-500/12 text-teal-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
                    )}
                  >
                    {formatCrimeLabel(t)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold tracking-wide text-slate-400">
                How serious was it?
              </legend>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={cn(
                      'risk-badge border text-xs font-semibold capitalize transition-opacity',
                      severityStyle[s],
                      severity === s ? 'opacity-100 ring-2 ring-white/20' : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    {s.toLowerCase()}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <label htmlFor="report-address" className="text-xs font-semibold tracking-wide text-slate-400">
                    Address or nearby landmark
                  </label>
                  <Input
                    id="report-address"
                    name="address"
                    autoComplete="street-address"
                    placeholder="e.g. House 12, Road 11, near Gulshan 1 Circle"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 shrink-0 border-white/15 bg-white/[0.03] hover:bg-white/10 sm:w-auto"
                  onClick={findTypedLocation}
                  disabled={placeLoading || locLoading}
                >
                  {placeLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <MapPin className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Find on map
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 shrink-0 border-white/15 bg-white/[0.03] hover:bg-white/10 sm:w-auto"
                  onClick={useCurrentLocation}
                  disabled={locLoading || placeLoading}
                >
                  {locLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Navigation className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Use my location
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="report-area" className="text-xs font-semibold tracking-wide text-slate-400">
                    Area
                  </label>
                  <Input
                    id="report-area"
                    name="area"
                    autoComplete="address-level3"
                    placeholder="e.g. Gulshan"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className={cn(areaInvalid && 'border-red-400/50 ring-1 ring-red-400/30')}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="report-district" className="text-xs font-semibold tracking-wide text-slate-400">
                    District
                  </label>
                  <Input
                    id="report-district"
                    name="district"
                    autoComplete="address-level2"
                    placeholder="e.g. Dhaka"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="report-division" className="text-xs font-semibold tracking-wide text-slate-400">
                    Division
                  </label>
                  <Input
                    id="report-division"
                    name="division"
                    autoComplete="address-level1"
                    placeholder="e.g. Dhaka Division"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                  />
                </div>
              </div>

              <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                <summary className="cursor-pointer select-none font-medium text-slate-300">
                  Edit coordinates manually
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="report-latitude" className="text-xs font-semibold tracking-wide text-slate-400">
                      Latitude
                    </label>
                    <Input
                      id="report-latitude"
                      name="latitude"
                      inputMode="decimal"
                      placeholder="23.7806"
                      value={latitude ?? ''}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        setLatitude(value ? Number(value) : null);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="report-longitude" className="text-xs font-semibold tracking-wide text-slate-400">
                      Longitude
                    </label>
                    <Input
                      id="report-longitude"
                      name="longitude"
                      inputMode="decimal"
                      placeholder="90.4193"
                      value={longitude ?? ''}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        setLongitude(value ? Number(value) : null);
                      }}
                    />
                  </div>
                </div>
              </details>

              <p className="text-xs text-slate-500">
                Use GPS for the fastest entry, or type a location and find it on the map. All saved location fields can
                be corrected before submitting.
              </p>
              {coordOk ? (
                <p className="text-xs text-emerald-400/90">
                  Coordinates attached: {latitude?.toFixed(5)}, {longitude?.toFixed(5)}.
                </p>
              ) : touched ? (
                <p className="text-xs text-rose-400/90">
                  Tap “Use my location”, “Find on map”, or enter coordinates manually.
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/15 p-4">
              <div className="rounded-xl bg-rose-500/10 p-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" aria-hidden />
              </div>
              <p className="text-sm text-slate-400">
                In a life-threatening emergency, use{' '}
                <Link href="/dashboard/sos" className="font-medium text-rose-400 underline-offset-4 hover:underline">
                  Emergency SOS
                </Link>{' '}
                instead of this form.
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="premium-button h-14 w-full text-base font-semibold disabled:opacity-60"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                'Submit report'
              )}
            </Button>
          </form>
        </Card>
      </motion.div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Verified reports typically appear on the live map shortly after submission.
      </p>
    </div>
  );
}
