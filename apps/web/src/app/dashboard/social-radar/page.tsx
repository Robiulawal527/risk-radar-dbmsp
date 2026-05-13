'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Heart, Star, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import type { SocialRadarMatch } from '@/lib/types';
import { toast } from 'sonner';

export default function SocialRadarPage() {
  const [interests, setInterests] = useState('');
  const [skills, setSkills] = useState('');

  const matchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{ success: boolean; data: SocialRadarMatch[] }>('/analytics/social-radar', {
        params: {
          interests: interests
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join(','),
          lookingFor: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join(','),
        },
      });
      return res.data.data ?? [];
    },
    onSuccess: (data) => {
      if (!data.length) toast.message('No matches yet', { description: 'Try broader interests or skills.' });
    },
    onError: () => {
      toast.error('Could not load matches');
    },
  });

  const matches = matchMutation.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-black tracking-tighter">Social Radar</h1>
        <p className="mt-2 text-xl text-slate-400">Find trusted allies from the registered community</p>
      </div>

      <Card className="glass-panel">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-xs tracking-widest text-slate-400">YOUR INTERESTS</label>
            <Input
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="mt-2"
              placeholder="e.g. Women Safety, Community Tech"
            />
          </div>
          <div>
            <label className="text-xs tracking-widest text-slate-400">SKILLS YOU SEEK</label>
            <Input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="mt-2"
              placeholder="e.g. React, Mentoring"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={() => matchMutation.mutate()}
          disabled={matchMutation.isPending}
          className="mt-6 w-full premium-button"
        >
          {matchMutation.isPending ? 'SEARCHING…' : 'FIND MY COMMUNITY MATCHES'}
        </Button>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {matches.map((match, index) => (
          <motion.div
            key={match.userId}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="glass-card flex h-full flex-col">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-teal-600 text-2xl font-bold ring-1 ring-white/10">
                    {match.name[0]}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{match.name}</div>
                    <div className="text-sm text-slate-400">{match.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-violet-300">{match.compatibilityScore}</div>
                  <div className="-mt-1 text-[10px] tracking-widest text-slate-500">MATCH</div>
                </div>
              </div>

              <div className="my-6 grid flex-1 grid-cols-3 gap-3 text-center text-sm">
                <div className="glass rounded-2xl p-3">
                  <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
                  <div className="font-semibold">{match.trustScore}</div>
                  <div className="text-xs text-slate-400">TRUST</div>
                </div>
                <div className="glass rounded-2xl p-3">
                  <Star className="mx-auto mb-1 h-5 w-5 text-amber-400" />
                  <div className="font-semibold">{match.goodWorkScore}</div>
                  <div className="text-xs text-slate-400">GOOD WORK</div>
                </div>
                <div className="glass rounded-2xl p-3">
                  <Heart className="mx-auto mb-1 h-5 w-5 text-violet-300" />
                  <div className="font-semibold">{match.crimeScore}</div>
                  <div className="text-xs text-slate-400">SAFETY</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {match.interests.slice(0, 3).map((i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {i}
                  </Badge>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {!matchMutation.isPending && matches.length === 0 && matchMutation.isSuccess ? (
        <p className="text-center text-sm text-slate-500">No rows returned. Adjust filters and search again.</p>
      ) : null}

      {!matchMutation.isSuccess && !matchMutation.isPending ? (
        <p className="text-center text-sm text-slate-500">Enter interests and skills, then run a search.</p>
      ) : null}
    </div>
  );
}
