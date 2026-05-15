'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Heart, Star, ShieldCheck, Phone, Mail, Award, CheckCircle2 } from 'lucide-react';
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
            <Card className="glass-card overflow-hidden transition-all hover:border-teal-500/30 hover:shadow-[0_0_20px_rgba(20,184,166,0.1)] flex h-full flex-col relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none">
                <Award className="h-24 w-24" />
              </div>
              <div className="flex flex-col h-full z-10 p-1">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-teal-500 text-2xl font-bold text-white shadow-lg ring-1 ring-white/20">
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-xl font-bold truncate tracking-tight text-white">{user.name}</h3>
                    <p className="text-sm text-slate-300 truncate">{user.email}</p>
                    
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-teal-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Verified Profile</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex-1">
                  <p className="text-xs font-semibold tracking-widest text-slate-500 mb-3 uppercase">Expertise & Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(user.skills) && user.skills.length > 0 ? (
                      user.skills.map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="bg-white/5 hover:bg-white/10 text-teal-100 border-white/10 px-2.5 py-1">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">No skills listed</span>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex gap-3 pt-4 border-t border-white/5">
                  {user.phone ? (
                     <Button variant="default" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-medium shadow-[0_0_15px_rgba(20,184,166,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all" asChild>
                       <a href={`tel:${user.phone}`}>
                         <Phone className="mr-2 h-4 w-4" />
                         Call
                       </a>
                     </Button>
                  ) : (
                     <Button variant="secondary" className="flex-1 bg-white/5 text-slate-400 pointer-events-none opacity-50">
                       <Phone className="mr-2 h-4 w-4" />
                       No Phone
                     </Button>
                  )}
                  
                  <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5" asChild>
                    <a href={`mailto:${user.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </a>
                  </Button>
                </div>
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
