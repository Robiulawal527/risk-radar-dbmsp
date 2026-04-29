import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export default function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points?.length) return undefined;

    const heatPoints = points.map((point) => [
      point.lat,
      point.lng,
      Math.max(0.15, point.intensity || point.riskScore / 100 || 0.3),
    ]);

    const layer = L.heatLayer(heatPoints, {
      radius: 42,
      blur: 34,
      maxZoom: 10,
      minOpacity: 0.35,
      gradient: {
        0.25: "lime",
        0.45: "yellow",
        0.7: "orange",
        1.0: "red",
      },
    }).addTo(map);

    return () => map.removeLayer(layer);
  }, [map, points]);

  return null;
}
