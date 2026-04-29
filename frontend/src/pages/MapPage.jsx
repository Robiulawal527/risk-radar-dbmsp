import { useCallback, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import CrimeMap from "../components/CrimeMap";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

export default function MapPage() {
  const [year, setYear] = useState("2025");
  const [type, setType] = useState("");
  const params = useMemo(() => ({ ...(year ? { year } : {}), ...(type ? { type } : {}) }), [year, type]);
  const { data: dashboard } = useApi(useCallback(() => api.getDashboard(), []), { categories: [] });
  const { data: crimes } = useApi(useCallback(() => api.getCrimes(params), [params]), []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1">
        <Navbar />

        <div className="p-5 grid xl:grid-cols-4 gap-5">
          <div className="xl:col-span-3 space-y-4">
            <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
              <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                <option value="">All years</option>
                {[2020, 2021, 2022, 2023, 2024, 2025].map((y) => <option key={y}>{y}</option>)}
              </select>
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                <option value="">All crime types</option>
                {dashboard.categories.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
            <CrimeMap year={year} type={type} />
          </div>

          <div className="glass rounded-2xl p-5 max-h-[620px] overflow-auto">
            <h2 className="font-bold text-xl mb-4">Crime Details</h2>

            <div className="space-y-4">
              {crimes.slice(0, 20).map((crime) => (
                <div key={crime.id} className="border-b border-slate-800 pb-4">
                  <p className="font-bold text-red-400">{crime.unitName}</p>
                  <p className="text-sm text-slate-300">{crime.monthName} {crime.year}</p>
                  <p className="text-xs text-slate-500">Risk: {crime.riskScore}/100 · {crime.severity}</p>
                  <p className="text-sm mt-2">{crime.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
