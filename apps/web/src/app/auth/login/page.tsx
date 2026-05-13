'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import axios from 'axios';
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

function LoginInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session?.access_token) {
        throw new Error(error?.message || 'Invalid credentials');
      }
      const accessToken = data.session.access_token;

      const meRes = await api.get<{ success: boolean; data: Record<string, unknown> }>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = mapUser(meRes.data.data);
      setSession(accessToken, user);

      toast.success('Welcome back');
      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard/map');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && !err.response) {
        toast.error('Cannot reach the API', {
          description:
            'Supabase sign-in worked, but /auth/me failed. From the repo root run pnpm backend (default http://127.0.0.1:3001). The web app proxies /api/backend to that server in dev.',
        });
        return;
      }
      const msg = (() => {
        if (err && typeof err === 'object' && 'response' in err) {
          return String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '');
        }
        if (err instanceof Error) return err.message;
        return 'Sign in failed';
      })();
      toast.error(msg || 'Sign in failed');
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
          <h1 className="text-4xl font-black tracking-tighter">Welcome back</h1>
          <p className="mt-2 text-slate-400">Sign in to your Risk Radar account</p>
        </div>

        <div className="glass-panel">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">EMAIL</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">PASSWORD</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="premium-button mt-4 h-12 w-full" disabled={loading}>
              {loading ? 'SIGNING IN…' : 'SIGN IN TO RISK RADAR'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-teal-400 hover:underline">
              Create one
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Use the account you registered with. Passwords are never stored in plain text.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070b14] p-6 text-slate-400">
          <div className="text-center text-sm">Loading…</div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
