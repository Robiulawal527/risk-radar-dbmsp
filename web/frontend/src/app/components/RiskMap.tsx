import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RiskPoint {
  lat: number;
  lng: number;
  intensity: number;
  type?: string;
  area?: string;
  date?: string;
}

export function RiskMap({ data, showHeatmap }: { data: RiskPoint[]; showHeatmap: boolean }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Array<L.Layer>>([]);

  const getColorByIntensity = (intensity) => {
    if (intensity >= 0.8) return '#dc2626';
    if (intensity >= 0.6) return '#ef4444';
    if (intensity >= 0.4) return '#f97316';
    if (intensity >= 0.2) return '#eab308';
    return '#22c55e';
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [23.8103, 90.4125],
      zoom: 12,
      zoomControl: true,
    });

    // Use light map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (showHeatmap) {
      // Create heatmap-like effect using circles with gradient
      data.forEach(point => {
        const color = getColorByIntensity(point.intensity);
        const circle = L.circle([point.lat, point.lng], {
          color: color,
          fillColor: color,
          fillOpacity: point.intensity * 0.5,
          radius: 300 + point.intensity * 200,
          weight: 0,
        }).addTo(mapRef.current!);

        markersRef.current.push(circle);
      });
    } else {
      // Create point markers
      data.forEach(point => {
        const color = getColorByIntensity(point.intensity);
        const circle = L.circle([point.lat, point.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.7,
          radius: 150,
          weight: 3,
          opacity: 1
        }).addTo(mapRef.current!);

        circle.bindPopup(`
          <div style="color: #1f2937; font-size: 14px; font-family: system-ui;">
            <div style="font-weight: 700; margin-bottom: 8px; color: #111827; font-size: 15px;">${point.type}</div>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
              <svg width="14" height="14" fill="${color}" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span style="font-size: 13px; color: #4b5563; font-weight: 500;">${point.area}</span>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">${point.date}</div>
            <div style="background: linear-gradient(135deg, ${color}15, ${color}25); padding: 8px 10px; border-radius: 8px; border: 1.5px solid ${color}40;">
              <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Risk Level</div>
              <div style="font-size: 16px; font-weight: 700; color: ${color};">${Math.round(point.intensity * 100)}%</div>
            </div>
          </div>
        `);

        markersRef.current.push(circle);
      });
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
  }, [data, showHeatmap]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#f9fafb'
      }}
    />
  );
}
