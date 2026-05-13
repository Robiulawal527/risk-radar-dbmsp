'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SOSStatus } from '@/lib/types';
import { AlertCircle, MapPin, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import type { SOSRequest } from '@/lib/types';

export default function SOSPage() {
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['sos-my'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SOSRequest[] }>('/sos/user');
      return res.data.data ?? [];
    },
  });

  const sendSOS = useMutation({
    mutationFn: async () => {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude } = pos.coords;
      const res = await api.post<{ success: boolean; data: SOSRequest }>('/sos/', {
        location: {
          latitude,
          longitude,
          area: 'GPS fix',
          address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        },
        message: 'Emergency assistance requested',
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('SOS sent', {
        description: 'Your request was stored. Use official emergency numbers for life-threatening situations.',
      });
      void qc.invalidateQueries({ queryKey: ['sos-my'] });
    },
    onError: (e: Error) => {
      toast.error('Could not send SOS', { description: e.message });
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-red-500/30 bg-red-500/5">
          <AlertCircle className="h-14 w-14 text-red-500" />
        </div>
        <h1 className="text-6xl font-black tracking-tighter text-white">Emergency SOS</h1>
        <p className="mt-3 text-xl text-slate-400">Uses your live GPS and stores an active SOS in the system</p>
      </div>

      <Card className="glass-panel border-red-500/20 p-12 text-center">
        <Button
          type="button"
          onClick={() => sendSOS.mutate()}
          disabled={sendSOS.isPending}
          className="danger-button mx-auto mb-6 h-24 w-24 rounded-full text-2xl shadow-[0_0_80px_-10px_rgb(239,68,68)]"
        >
          {sendSOS.isPending ? '…' : 'SOS'}
        </Button>

        <div className="mx-auto max-w-xs text-sm text-slate-400">
          For real emergencies also call local emergency services. This button records your location in Risk Radar.
        </div>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4" /> YOUR RECENT REQUESTS
          </div>
          <Badge variant="secondary">{isLoading ? '…' : `${requests.length} TOTAL`}</Badge>
        </div>

        <div className="space-y-3">
          {requests.length > 0 ? (
            requests.map((req, index) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="glass-card flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <MapPin className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <div className="font-semibold">{req.location.area ?? 'Location'}</div>
                    <div className="text-xs text-slate-400">{new Date(req.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <Badge
                  variant={
                    req.status === SOSStatus.ACTIVE
                      ? 'destructive'
                      : req.status === SOSStatus.RESOLVED
                        ? 'success'
                        : 'secondary'
                  }
                >
                  {req.status}
                </Badge>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400">
              {isLoading ? 'Loading…' : 'No emergency requests yet. Stay safe.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
