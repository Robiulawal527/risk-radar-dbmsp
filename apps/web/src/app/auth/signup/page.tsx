'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { AuthUser } from '@/store/auth';
import type { UserRole } from '@/lib/types';

function mapUser(u: Record<string, unknown>): AuthUser {
  return {
    id: String(u.id),
    name: String(u.name ?? ''),
    email: String(u.email ?? ''),
    role: (String(u.role ?? 'USER').toUpperCase() as UserRole) || 'USER',
    avatar: u.avatar != null ? String(u.avatar) : undefined,
    phone: u.phone != null ? String(u.phone) : undefined,
    alertLatitude: typeof u.alertLatitude === 'number' ? u.alertLatitude : null,
    alertLongitude: typeof u.alertLongitude === 'number' ? u.alertLongitude : null,
    alertsEnabled: typeof u.alertsEnabled === 'boolean' ? u.alertsEnabled : u.alertsEnabled == null ? null : Boolean(u.alertsEnabled),
  };
}

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setSession } = useAuthStore();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        toast.error('Supabase is not configured', {
          description:
            'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in apps/web env.',
        });
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error('Supabase client not available');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error) throw new Error(error.message);

      // If email confirmation is enabled, there may be no session yet.
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        toast.success('Account created', {
          description: 'Please check your email to confirm your account, then sign in.',
        });
        router.push('/auth/login');
        return;
      }

      const meRes = await api.get<{ success: boolean; data: Record<string, unknown> }>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSession(accessToken, mapUser(meRes.data.data));

      toast.success('Account created');
      router.push('/dashboard/map');
    } catch (err: unknown) {
      const msg = (() => {
        if (err && typeof err === 'object' && 'response' in err) {
          return String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '');
        }
        if (err instanceof Error) return err.message;
        return 'Could not create account';
      })();
      toast.error(msg || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-700 ring-1 ring-white/10">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Join the movement</h1>
          <p className="mt-2 text-slate-400">Create your account to report and receive area alerts</p>
        </div>

        <div className="glass-panel">
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">FULL NAME</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">EMAIL</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">CREATE PASSWORD</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="premium-button mt-4 h-12 w-full" disabled={loading}>
              {loading ? 'CREATING ACCOUNT…' : 'CREATE FREE ACCOUNT'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-teal-400 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
