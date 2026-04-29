import { useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export default function AdminDashboard() {
  const { data } = useApi(useCallback(() => api.getDashboard(), []), {
    stats: {},
    rankings: [],
    categoryChart: [],
    trend: [],
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1">
        <Navbar />

        <div className="p-5 space-y-5">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>

          <div className="grid md:grid-cols-4 gap-4">
            <StatCard title="Total Cases" value={data.stats.totalCases?.toLocaleString() || "..."} change="All CSV rows" />
            <StatCard title="Data Records" value={data.stats.totalRecords || "..."} change="Monthly unit records" color="text-green-400" />
            <StatCard title="Avg Cases/Record" value={data.stats.averageMonthlyCases?.toLocaleString() || "..."} change="Calculated live" color="text-green-400" />
            <StatCard title="High Risk Units" value={data.stats.highRiskAreas || "..."} change="Score ≥ 70" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="glass rounded-2xl p-5 h-80">
              <h2 className="font-bold mb-4">Crime Trend</h2>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={data.trend}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="crimes" stroke="#ef4444" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-2xl p-5 h-80">
              <h2 className="font-bold mb-4">Crime by Category</h2>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={data.categoryChart} dataKey="value" outerRadius={100} label>
                    {data.categoryChart.map((_, index) => (
                      <Cell key={index} fill={["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6", "#64748b"][index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
