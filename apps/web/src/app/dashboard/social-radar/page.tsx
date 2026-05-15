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
  const [skillSearch, setSkillSearch] = useState('');

  const matchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{ success: boolean; data: any[] }>('/users/search', {
        params: { skill: skillSearch.trim() },
      });
      return res.data.data ?? [];
    },
    onSuccess: (data) => {
      if (!data.length) toast.message('No matches yet', { description: 'Try a different skill.' });
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
        <div>
          <label className="text-xs tracking-widest text-slate-400">SEARCH BY SKILL</label>
          <Input
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            className="mt-2"
            placeholder="e.g. doctor, engineer, web developer"
            onKeyDown={(e) => { if (e.key === 'Enter') matchMutation.mutate(); }}
          />
        </div>
        <Button
          type="button"
          onClick={() => matchMutation.mutate()}
          disabled={matchMutation.isPending}
          className="mt-6 w-full premium-button"
        >
          {matchMutation.isPending ? 'SEARCHING…' : 'FIND PEOPLE BY SKILL'}
        </Button>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {matches.map((user, index) => (
          <motion.div
            key={user.id || user.userId}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="glass-card flex h-full flex-col">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-teal-600 text-2xl font-bold ring-1 ring-white/10">
                    {(user.name || user.email || '?')[0]}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{user.name}</div>
                    <div className="text-sm text-slate-400">{user.email}</div>
                    {user.phone && (
                      <div className="text-xs text-slate-400 mt-1">
                        <a href={`tel:${user.phone}`} className="text-teal-400 underline">Call</a>
                        <span className="ml-2">{user.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="my-4 flex flex-wrap gap-2">
                {Array.isArray(user.skills) && user.skills.length > 0 ? (
                  user.skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No skills listed</span>
                )}
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
