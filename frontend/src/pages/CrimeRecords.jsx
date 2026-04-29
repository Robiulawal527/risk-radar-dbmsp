import { useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

export default function CrimeRecords() {
  const { data: crimes } = useApi(useCallback(() => api.getCrimes({ year: 2025 }), []), []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1">
        <Navbar />

        <div className="p-5">
          <div className="flex justify-between mb-5">
            <h1 className="text-3xl font-bold">Crime Records</h1>
            <button className="bg-red-600 px-5 py-2 rounded-xl">+ Add Record</button>
          </div>

          <div className="glass rounded-2xl overflow-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-4 text-left">ID</th>
                  <th className="p-4 text-left">Top Type</th>
                  <th className="p-4 text-left">Unit</th>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Total Cases</th>
                  <th className="p-4 text-left">Risk</th>
                  <th className="p-4 text-left">Severity</th>
                </tr>
              </thead>

              <tbody>
                {crimes.map((crime) => (
                  <tr key={crime.id} className="border-t border-slate-800">
                    <td className="p-4">#{crime.id}</td>
                    <td className="p-4 text-red-400 font-bold">{crime.topCrimeType}</td>
                    <td className="p-4">{crime.unitName}</td>
                    <td className="p-4">{crime.monthName} {crime.year}</td>
                    <td className="p-4">{crime.totalCases.toLocaleString()}</td>
                    <td className="p-4">{crime.riskScore}/100</td>
                    <td className="p-4 text-green-400">{crime.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
