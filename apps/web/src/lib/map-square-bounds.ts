/**
 * Build an axis-aligned "square on the ground" bounding box (~areaKm² visible)
 * centered at (lat, lng). Uses spherical approximations (accurate ~meters-scale for BD latitudes).
 */
export function latLngSquareBoundsKm2(
  centerLat: number,
  centerLng: number,
  areaKm2: number
): [[number, number], [number, number]] {
  const sideKm = Math.sqrt(areaKm2);
  const halfMeters = (sideKm * 1000) / 2;
  const metersPerDegLat = 111_320;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const safeCos = Math.max(Math.abs(cosLat), 0.01);
  const metersPerDegLng = metersPerDegLat * safeCos;
  const deltaLat = halfMeters / metersPerDegLat;
  const deltaLng = halfMeters / metersPerDegLng;
  return [
    [centerLat - deltaLat, centerLng - deltaLng],
    [centerLat + deltaLat, centerLng + deltaLng],
  ];
}

/** Approximate geographic center of Bangladesh (fallback heatmap viewport). */
export const BANGLADESH_DEFAULT_CENTER = { lat: 23.685, lng: 90.3563 } as const;
