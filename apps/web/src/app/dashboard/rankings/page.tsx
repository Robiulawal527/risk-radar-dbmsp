'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { CriminalRanking, PhilanthropistRanking } from '@/lib/types';
import { AlertTriangle, Trophy } from 'lucide-react';

export default function RankingsPage() {
  const criminalsQ = useQuery({
    queryKey: ['rankings-criminals'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: CriminalRanking[] }>('/analytics/rankings/criminals');
      return res.data.data ?? [];
    },
  });

  const heroesQ = useQuery({
    queryKey: ['rankings-philanthropists'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PhilanthropistRanking[] }>(
        '/analytics/rankings/philanthropists'
      );
      return res.data.data ?? [];
    },
  });

  const criminals = criminalsQ.data ?? [];
  const heroes = heroesQ.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-black tracking-tighter">Community Rankings</h1>
        <p className="text-xl text-slate-400">From your database: records and top reporters</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel">
          <div className="mb-6 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <div>
              <div className="text-2xl font-bold">Criminal records</div>
              <div className="text-sm text-amber-400/90">From CriminalRecord table (if populated)</div>
            </div>
          </div>

          {criminalsQ.isError ? (
            <p className="text-sm text-slate-400">Could not load rankings.</p>
          ) : criminals.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No criminal records yet.</p>
          ) : (
            <div className="space-y-4">
              {criminals.map((criminal) => (
                <div
                  key={criminal.rank + criminal.criminalInfo.name}
                  className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:border-amber-500/25"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 text-3xl font-black text-amber-400/80">#{criminal.rank}</div>
                    <div>
                      <div className="font-semibold">{criminal.criminalInfo.name}</div>
                      <div className="text-xs text-slate-400">
                        {String(criminal.mostFrequentCrime).replace(/_/g, ' ')} • {criminal.crimeCount} linked
                        incidents
                      </div>
                    </div>
                  </div>
                  <Badge variant="destructive">{criminal.dangerLevel}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="glass-panel">
          <div className="mb-6 flex items-center gap-3">
            <Trophy className="h-6 w-6 text-amber-400" />
            <div>
              <div className="text-2xl font-bold">Top reporters</div>
              <div className="text-sm text-emerald-400">By number of submitted crime reports</div>
            </div>
          </div>

          {heroesQ.isError ? (
            <p className="text-sm text-slate-400">Could not load rankings.</p>
          ) : heroes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No report activity yet.</p>
          ) : (
            <div className="space-y-4">
              {heroes.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:border-emerald-500/30"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 text-3xl font-black ${
                        index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : 'text-orange-400'
                      }`}
                    >
                      #{user.rank}
                    </div>
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-xs text-slate-400">
                        {user.reportsSubmitted} reports • {(user.accuracy * 100).toFixed(0)}% score weight
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400">{user.contribution}</div>
                    <div className="text-[10px] text-slate-500">POINTS</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="pt-4 text-center text-xs text-slate-500">Rankings refresh when you reload or revisit this page.</div>
    </div>
  );
}
