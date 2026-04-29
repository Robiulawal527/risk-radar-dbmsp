import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import HeatLayer from "./HeatLayer";
import { api } from "../api/client";

export default function CrimeMap({ year = "", type = "" }) {
  const [heatPoints, setHeatPoints] = useState([]);
  const [crimes, setCrimes] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = {};
    if (year) params.year = year;
    if (type) params.type = type;

    Promise.all([api.getHeatmap(params), api.getCrimes(params)])
      .then(([heatmap, records]) => {
        setHeatPoints(heatmap);
        setCrimes(records.slice(0, 80));
      })
      .catch((err) => setError(err.message));
  }, [year, type]);

  return (
    <div className="relative h-[520px] rounded-3xl overflow-hidden border border-slate-800 map-glow">
      {error && (
        <div className="absolute top-3 left-3 z-[999] bg-red-950/90 border border-red-700 text-red-100 px-4 py-2 rounded-xl text-sm">
          Backend offline. Start the API server on port 5000.
        </div>
      )}

      <MapContainer
        center={[23.685, 90.3563]}
        zoom={7}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <HeatLayer points={heatPoints} />

        {crimes.map((crime) => (
          <CircleMarker
            key={crime.id}
            center={[crime.lat, crime.lng]}
            radius={crime.severity === "High" ? 12 : crime.severity === "Medium" ? 9 : 6}
            pathOptions={{
              color: crime.severity === "High" ? "#ef4444" : crime.severity === "Medium" ? "#f97316" : "#22c55e",
              fillColor: crime.severity === "High" ? "#ef4444" : crime.severity === "Medium" ? "#f97316" : "#22c55e",
              fillOpacity: 0.7,
            }}
          >
            <Popup>
              <strong>{crime.unitName}</strong>
              <br />
              {crime.monthName} {crime.year}
              <br />
              Total cases: {crime.totalCases.toLocaleString()}
              <br />
              Top crime: {crime.topCrimeType} ({crime.topCrimeCount})
              <br />
              Risk score: {crime.riskScore}/100
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[999] glass rounded-2xl p-3 flex gap-3 text-xs">
        <span className="flex items-center gap-1"><b className="w-3 h-3 bg-green-500 rounded-sm" /> Low</span>
        <span className="flex items-center gap-1"><b className="w-3 h-3 bg-orange-500 rounded-sm" /> Medium</span>
        <span className="flex items-center gap-1"><b className="w-3 h-3 bg-red-500 rounded-sm" /> High</span>
      </div>
    </div>
  );
}
