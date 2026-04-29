import { useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import CrimeMap from "../components/CrimeMap";
import StatCard from "../components/StatCard";
import AlertCard from "../components/AlertCard";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

export default function Dashboard() {
  const { data, loading } = useApi(useCallback(() => api.getDashboard(), []), {
    stats: {},
    rankings: [],
  });

  const topAreas = data.rankings.slice(0, 5);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1">
        <Navbar />

        <div className="p-5 grid xl:grid-cols-4 gap-5">
          <div className="xl:col-span-3 space-y-5">
            <CrimeMap />

            <div className="grid md:grid-cols-4 gap-4">
              <StatCard title="Total Cases" value={loading ? "..." : data.stats.totalCases?.toLocaleString()} change="From CSV dataset" />
              <StatCard title="Monthly Records" value={loading ? "..." : data.stats.totalRecords} change="2020-2025 rows" />
              <StatCard title="High Risk Units" value={loading ? "..." : data.stats.highRiskAreas} change="Calculated score ≥ 70" />
              <StatCard title="Avg Monthly Cases" value={loading ? "..." : data.stats.averageMonthlyCases?.toLocaleString()} change="Per police unit" />
            </div>
          </div>

          <aside className="space-y-5">
            <div className="glass rounded-2xl p-5">
              <p className="text-slate-400 text-sm">Highest Risk Area</p>
              <h2 className="font-bold mt-1">{topAreas[0]?.area || "Loading..."}</h2>

              <div className="mt-6">
                <p className="text-slate-400 text-sm">Risk Score</p>
                <h1 className="text-5xl font-black">
                  {topAreas[0]?.score || "..."}<span className="text-xl text-slate-400">/100</span>
                </h1>
                <p className="text-red-500 font-bold mt-2">High Risk</p>
              </div>
            </div>

            <div className="space-y-3">
              {topAreas.slice(0, 3).map((area) => (
                <AlertCard
                  key={area.unit}
                  type="High Risk Hotspot"
                  area={`${area.area} - ${area.totalCases.toLocaleString()} cases`}
                  time="Dataset alert"
                />
              ))}
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-bold mb-4">Area Safety Ranking</h3>
              <div className="space-y-3">
                {topAreas.map((item, index) => (
                  <div key={item.unit} className="flex justify-between text-sm">
                    <span>{index + 1}. {item.area}</span>
                    <span className="bg-red-600 px-2 rounded">{item.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
