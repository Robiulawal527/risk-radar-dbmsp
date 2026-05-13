'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { emptyDashboardStats } from '@/lib/empty-dashboard-stats';
import type { DashboardStats, Severity } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, AlertTriangle, Users, Award } from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#f43f5e', '#eab308'];

export default function AnalyticsPage() {
  const { data: stats = emptyDashboardStats(), isError } = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardStats }>('/analytics/stats');
      return res.data.data;
    },
    retry: 1,
  });

  const crimeTypeData = Object.entries(stats.crimesByType)
    .map(([type, count]) => ({ name: type.replace(/_/g, ' '), value: count as number }))
    .sort((a, b) => b.value - a.value);

  const severityData = (Object.entries(stats.crimesBySeverity) as [Severity, number][]).map(
    ([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length],
    })
  );

  const trendData = stats.trends.slice(-14);
  const topCategory = crimeTypeData[0] ?? { name: '—', value: 0 };
  const avgDaily =
    stats.trends.length > 0
      ? Math.round(stats.trends.reduce((sum, t) => sum + t.count, 0) / stats.trends.length)
      : 0;

  const hotspotCount = stats.crimesByArea.filter(
    (a) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL'
  ).length;

  const trendLabel =
    stats.trends.length >= 2
      ? stats.trends.at(-1)!.count >= stats.trends[0]!.count
        ? 'Up vs window start'
        : 'Down vs window start'
      : '—';

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-teal-500/10 p-3">
            <TrendingUp className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter">Crime Analytics</h1>
            <p className="text-xl text-slate-400">Live intelligence from your Risk Radar database</p>
          </div>
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-amber-400">Could not load analytics. Check that you are signed in and the API is reachable.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: 'TOTAL REPORTS', value: stats.totalCrimes.toLocaleString(), icon: AlertTriangle, change: trendLabel },
          { label: 'DAILY AVERAGE', value: String(avgDaily), icon: TrendingUp, change: '30-day window' },
          { label: 'TOP CATEGORY', value: topCategory.name, icon: Award, change: `${topCategory.value} reports` },
          { label: 'HIGH-RISK AREAS', value: String(hotspotCount), icon: Users, change: 'HIGH / CRITICAL' },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass-panel flex items-center justify-between"
          >
            <div>
              <div className="mb-1 text-xs uppercase tracking-[1.5px] text-slate-500">{metric.label}</div>
              <div className="text-4xl font-black tracking-tighter text-white">{metric.value}</div>
            </div>
            <div className="text-right">
              <metric.icon className="mx-auto mb-1 h-8 w-8 text-teal-400" />
              <div className="text-xs text-emerald-400">{metric.change}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="glass-panel xl:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Crime categories</h3>
              <p className="text-sm text-slate-400">All-time distribution in the database</p>
            </div>
            <Badge variant="secondary" className="bg-white/10">
              Live
            </Badge>
          </div>

          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crimeTypeData}>
                <CartesianGrid strokeDasharray="2 2" stroke="#ffffff10" />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  height={85}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis tick={{ fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15,23,42,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass-panel xl:col-span-2">
          <h3 className="mb-1 text-2xl font-bold">Severity breakdown</h3>
          <p className="mb-6 text-sm text-slate-400">Operational urgency levels</p>

          <div className="space-y-5">
            {severityData.map((item, index) => (
              <div key={index}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-mono text-slate-400">{item.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${stats.totalCrimes > 0 ? (item.value / stats.totalCrimes) * 100 : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-xs text-slate-400">
            Counts reflect records in the <code className="text-slate-300">Crime</code> table.
          </div>
        </Card>
      </div>

      <Card className="glass-panel">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">30-day trend</h3>
            <p className="text-sm text-slate-400">Daily incident volume from stored reports</p>
          </div>
        </div>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData.length ? trendData : [{ date: '—', count: 0 }]}>
              <CartesianGrid strokeDasharray="2 2" stroke="#ffffff10" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
              <Line
                type="natural"
                dataKey="count"
                stroke="#22d3ee"
                strokeWidth={4}
                dot={{ r: 4, fill: '#22d3ee', strokeWidth: 2, stroke: '#0f172a' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="pt-4 text-center text-xs text-slate-500">Data is read from your deployed API and database.</div>
    </div>
  );
}
