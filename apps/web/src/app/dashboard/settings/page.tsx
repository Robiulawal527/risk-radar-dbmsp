'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { MapPin, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { user, logout, patchUser } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState<string>('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone || '');
    setSkills((user.skills || []).join(', '));
    setAlertsEnabled(user.alertsEnabled !== false);
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const skillsArr = skills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const res = await api.put<{ success: boolean; data: Record<string, unknown> }>('/users/profile', {
        name: name.trim(),
        phone: phone.trim(),
        skills: skillsArr,
        alertsEnabled,
      });
      const d = res.data.data;
      patchUser({
        name: String(d.name ?? name),
        phone: d.phone != null ? String(d.phone) : undefined,
        skills: Array.isArray(d.skills) ? d.skills : skillsArr,
        avatar: d.avatar != null ? String(d.avatar) : undefined,
        alertLatitude: typeof d.alertLatitude === 'number' ? d.alertLatitude : null,
        alertLongitude: typeof d.alertLongitude === 'number' ? d.alertLongitude : null,
        alertsEnabled: typeof d.alertsEnabled === 'boolean' ? d.alertsEnabled : alertsEnabled,
      });
      toast.success('Profile saved');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error)
          : 'Could not save';
      toast.error(msg || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const saveAlertZoneFromGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available in this browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await api.put<{ success: boolean; data: Record<string, unknown> }>('/users/profile', {
            alertLatitude: lat,
            alertLongitude: lng,
            alertsEnabled: true,
          });
          const d = res.data.data;
          patchUser({
            alertLatitude: typeof d.alertLatitude === 'number' ? d.alertLatitude : lat,
            alertLongitude: typeof d.alertLongitude === 'number' ? d.alertLongitude : lng,
            alertsEnabled: true,
          });
          setAlertsEnabled(true);
          toast.success('Nearby alerts enabled', {
            description: 'New incidents within your alert radius will create in-app notifications.',
          });
        } catch (err: unknown) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error)
              : 'Could not update alert zone';
          toast.error(msg || 'Could not update alert zone');
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsLoading(false);
        toast.error('Could not read GPS', { description: 'Allow location access and try again.' });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-5xl font-black tracking-tighter">Account settings</h1>
        <p className="text-slate-400">Profile and incident alerts</p>
      </div>

      <Card className="glass-panel">
        <h3 className="mb-6 text-xl font-semibold">Profile</h3>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-slate-400">FULL NAME</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <label className="text-xs text-slate-400">EMAIL</label>
            <Input value={user?.email ?? ''} className="mt-1.5" disabled />
          </div>
          <div>
            <label className="text-xs text-slate-400">PHONE NUMBER</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" placeholder="e.g. +1234567890" />
          </div>
          <div>
            <label className="text-xs text-slate-400">SKILLS</label>
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} className="mt-1.5" placeholder="e.g. doctor, engineer, web developer" />
            <span className="text-xs text-slate-500">Comma-separated (e.g. doctor, engineer, web developer)</span>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-white/5"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
            />
            Enable nearby incident notifications
          </label>
        </div>

        <Button className="mt-6 w-full" disabled={saving} onClick={() => void saveProfile()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </Card>

      <Card className="glass-panel border-teal-500/20">
        <h3 className="mb-2 text-xl font-semibold text-teal-200">Alert location (~10 km²)</h3>
        <p className="mb-4 text-sm text-slate-400">
          Save the point you care about (often home or work). When someone files a report within the configured radius,
          you get an in-app notification while signed in.
        </p>
        {user?.alertLatitude != null && user?.alertLongitude != null ? (
          <p className="mb-4 text-xs text-slate-500">
            Saved: {user.alertLatitude.toFixed(4)}, {user.alertLongitude.toFixed(4)}
          </p>
        ) : (
          <p className="mb-4 text-xs text-slate-500">No alert point saved yet.</p>
        )}
        <Button type="button" variant="outline" className="w-full border-white/20" disabled={gpsLoading} onClick={saveAlertZoneFromGps}>
          {gpsLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reading GPS…
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Use current location as alert zone
            </>
          )}
        </Button>
      </Card>

      <Card className="glass-panel border-red-500/20">
        <h3 className="mb-2 text-xl font-semibold text-red-400">Sign out</h3>
        <p className="mb-6 text-sm text-slate-400">Ends this session in the browser</p>

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            getSupabaseBrowserClient()?.auth.signOut().catch(() => {});
            logout();
            toast.message('Signed out');
            window.location.href = '/';
          }}
        >
          Log out
        </Button>
      </Card>
    </div>
  );
}
