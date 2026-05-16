'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { BANGLADESH_DEFAULT_CENTER, latLngSquareBoundsKm2 } from '@/lib/map-square-bounds';
import type { Crime, SOSRequest } from '@/lib/types';
import { Severity, SOSStatus } from '@/lib/types';

type HeatLeaflet = typeof L & {
  heatLayer: (
    latlngs: Array<[number, number, number?]>,
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      max?: number;
      minOpacity?: number;
      gradient?: Record<number, string>;
    }
  ) => L.Layer;
};

const LeafletHeat = L as HeatLeaflet;

function fixLeafletIcons() {
  const proto = L.Icon.Default.prototype as L.Icon.Default & {
    _getIconUrl?: string;
  };
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function severityWeight(severity: Crime['severity']): number {
  switch (severity) {
    case Severity.CRITICAL:
      return 1;
    case Severity.HIGH:
      return 0.72;
    case Severity.MEDIUM:
      return 0.45;
    default:
      return 0.28;
  }
}

function severityMarkerStyle(severity: Crime['severity']): {
  color: string;
  fillColor: string;
  fillOpacity: number;
} {
  switch (severity) {
    case Severity.CRITICAL:
      return { color: '#fecaca', fillColor: '#ef4444', fillOpacity: 0.92 };
    case Severity.HIGH:
      return { color: '#fed7aa', fillColor: '#f97316', fillOpacity: 0.9 };
    case Severity.MEDIUM:
      return { color: '#fde68a', fillColor: '#eab308', fillOpacity: 0.88 };
    default:
      return { color: '#a7f3d0', fillColor: '#10b981', fillOpacity: 0.85 };
  }
}

/** ~10 km² default viewport centered on geographic Bangladesh (see `focusSquareKm2` for sizing). */

function hasRenderableSize(map: L.Map): boolean {
  const container = map.getContainer();
  const { width, height } = container.getBoundingClientRect();
  return width > 0 && height > 0;
}

function invalidateSizeWhenRenderable(map: L.Map): void {
  if (!hasRenderableSize(map)) return;
  map.invalidateSize({ animate: false });
}

export interface CrimeMapProps {
  crimes: Crime[];
  sosAlerts?: SOSRequest[];
  /** When true, parent should show an empty-state overlay instead of relying on map popups. */
  showEmptyState?: boolean;
}

export interface CrimeMapHandle {
  /** Fit map to ~`areaKm2` sized square centered on the point (WGS84). */
  focusSquareKm2: (latitude: number, longitude: number, areaKm2?: number) => void;
  /** Nominatim order: south, north, west, east in degrees WGS84. */
  fitNominatimBoundingBox: (south: number, north: number, west: number, east: number) => void;
}

const CrimeMap = forwardRef<CrimeMapHandle, CrimeMapProps>(function CrimeMap(
  { crimes, sosAlerts = [], showEmptyState = false }: CrimeMapProps,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  useImperativeHandle(ref, () => ({
    focusSquareKm2(latitude: number, longitude: number, areaKm2 = 10) {
      const map = mapRef.current;
      if (!map) return;
      const corners = latLngSquareBoundsKm2(latitude, longitude, areaKm2);
      map.fitBounds(L.latLngBounds(corners[0], corners[1]), {
        animate: true,
        padding: [14, 14],
        maxZoom: 16,
      });
    },
    fitNominatimBoundingBox(south: number, north: number, west: number, east: number) {
      const map = mapRef.current;
      if (!map) return;
      if (![south, north, west, east].every(Number.isFinite) || south >= north || west >= east) {
        return;
      }
      map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { animate: true, padding: [20, 20], maxZoom: 17 }
      );
    },
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const corners = latLngSquareBoundsKm2(
      BANGLADESH_DEFAULT_CENTER.lat,
      BANGLADESH_DEFAULT_CENTER.lng,
      10
    );
    map.fitBounds(L.latLngBounds(corners[0], corners[1]), {
      animate: false,
      padding: [14, 14],
      maxZoom: 16,
    });

    mapRef.current = map;

    let cancelled = false;
    const tryGeolocate =
      typeof navigator !== 'undefined' &&
      typeof navigator.geolocation?.getCurrentPosition === 'function';
    if (tryGeolocate) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const geoCorners = latLngSquareBoundsKm2(pos.coords.latitude, pos.coords.longitude, 10);
          map.fitBounds(L.latLngBounds(geoCorners[0], geoCorners[1]), {
            animate: true,
            padding: [14, 14],
            maxZoom: 16,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
      );
    }

    const onResize = () => invalidateSizeWhenRenderable(map);
    requestAnimationFrame(onResize);

    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    resizeObserverRef.current = ro;

    return () => {
      cancelled = true;
      ro.disconnect();
      resizeObserverRef.current = null;
      if (heatRef.current) {
        try {
          map.removeLayer(heatRef.current);
        } catch {
          /* already removed */
        }
      }
      heatRef.current = null;
      if (markersRef.current) {
        try {
          map.removeLayer(markersRef.current);
        } catch {
          /* already removed */
        }
      }
      markersRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }
    if (markersRef.current) {
      map.removeLayer(markersRef.current);
      markersRef.current = null;
    }

    if (!crimes.length && !sosAlerts.length) {
      requestAnimationFrame(() => invalidateSizeWhenRenderable(map));
      return;
    }

    if (!hasRenderableSize(map)) {
      requestAnimationFrame(() => invalidateSizeWhenRenderable(map));
      return;
    }

    const heatGradient: Record<number, string> = {
      0: 'rgba(13, 148, 136, 0)',
      0.25: 'rgba(34, 211, 238, 0.45)',
      0.5: 'rgba(234, 179, 8, 0.65)',
      0.72: 'rgba(249, 115, 22, 0.82)',
      1: 'rgba(239, 68, 68, 0.95)',
    };

    const points: [number, number, number][] = crimes.map((c) => [
      c.location.latitude,
      c.location.longitude,
      severityWeight(c.severity),
    ]);

    const maxIntensity = Math.max(0.35, ...points.map((p) => p[2] ?? 0));

    const heatLayer = LeafletHeat.heatLayer(points, {
      radius: 32,
      blur: 22,
      maxZoom: 18,
      max: maxIntensity,
      minOpacity: 0.25,
      gradient: heatGradient,
    }).addTo(map);
    heatRef.current = heatLayer;

    const markerGroup = L.layerGroup();
    for (const c of crimes) {
      const { color, fillColor, fillOpacity } = severityMarkerStyle(c.severity);
      const marker = L.circleMarker([c.location.latitude, c.location.longitude], {
        radius: 7,
        stroke: true,
        weight: 2,
        color,
        fillColor,
        fillOpacity,
      });

      const when = c.dateTime instanceof Date ? c.dateTime.toLocaleString() : String(c.dateTime);
      const area = c.location.area || c.location.district || 'Unknown area';
      marker.bindPopup(
        `<div class="crime-popup text-slate-100 text-sm max-w-[240px]">
          <div class="font-semibold text-white mb-1">${escapeHtml(c.title)}</div>
          <div class="text-xs text-slate-400 mb-2">${escapeHtml(area)} · ${escapeHtml(String(c.severity))}</div>
          <div class="text-xs text-slate-300 leading-snug">${escapeHtml(c.description.slice(0, 220))}${c.description.length > 220 ? '…' : ''}</div>
          <div class="text-[10px] text-slate-500 mt-2">${escapeHtml(when)}</div>
        </div>`,
        { maxWidth: 280, className: 'crime-map-popup' }
      );
      marker.addTo(markerGroup);
    }
    for (const sos of sosAlerts) {
      if (sos.status !== SOSStatus.ACTIVE) continue;
      const latitude = Number(sos.location?.latitude);
      const longitude = Number(sos.location?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const marker = L.circleMarker([latitude, longitude], {
        radius: 11,
        stroke: true,
        weight: 3,
        color: '#fff',
        fillColor: '#dc2626',
        fillOpacity: 0.95,
      });
      const created = sos.createdAt instanceof Date ? sos.createdAt.toLocaleString() : String(sos.createdAt);
      marker.bindPopup(
        `<div class="crime-popup text-slate-100 text-sm max-w-[240px]">
          <div class="font-semibold text-white mb-1">Live SOS alert</div>
          <div class="text-xs text-red-200 mb-2">${escapeHtml(sos.message || 'Emergency assistance requested')}</div>
          <div class="text-xs text-slate-300">Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</div>
          <div class="text-[10px] text-slate-500 mt-2">${escapeHtml(created)}</div>
        </div>`,
        { maxWidth: 280, className: 'crime-map-popup' }
      );
      marker.addTo(markerGroup);
    }
    markerGroup.addTo(map);
    markersRef.current = markerGroup;

    requestAnimationFrame(() => invalidateSizeWhenRenderable(map));
  }, [crimes, sosAlerts, showEmptyState]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-[400px] z-0"
      role="application"
      aria-label="Crime incidents map with heat intensity"
    />
  );
});

CrimeMap.displayName = 'CrimeMap';

export default CrimeMap;
