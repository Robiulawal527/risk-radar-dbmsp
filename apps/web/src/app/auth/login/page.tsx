'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuthStore, type AuthUser } from '@/store/auth';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '@/lib/api';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { mapAuthUser, type AuthTokenResponse } from '@/lib/auth-session';
import { UserRole } from '@/lib/types';

type AccountMode = 'USER' | 'ADMIN';
const ACTIVE_ADMIN_STATUSES = new Set(['ACTIVE', 'APPROVED', 'VERIFIED', 'ENABLED']);

function isApprovedAdminStatus(value: unknown): boolean {
  return typeof value === 'string' && ACTIVE_ADMIN_STATUSES.has(value.trim().toUpperCase());
}

function LoginInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<AccountMode>('USER');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuthStore();

  const ensureAccountProfile = async (accessToken: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    const userEmail = data.user?.email ?? email.trim();
    if (!userId || !userEmail) return;
    const metadata = data.user?.user_metadata ?? {};
    const displayName =
      typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name.trim()
        : userEmail.split('@')[0] || 'User';
    const now = new Date().toISOString();
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        full_name: displayName,
        updated_at: now,
      } as never)
      .select('id')
      .maybeSingle();
  };

  const promoteApprovedSupabaseAdmin = async (
    accessToken: string,
    authUser: AuthUser
  ): Promise<AuthUser> => {
    if (authUser.role === UserRole.ADMIN) return authUser;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return authUser;

    const { data } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    const userEmail = data.user?.email ?? email.trim();
    if (!userId) return authUser;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    const adminQuery = supabase.from('admins').select('status').eq('id', userId).maybeSingle();
    let admin = (await adminQuery).data as Record<string, unknown> | null;
    if (!admin && userEmail) {
      const byEmail = await supabase
        .from('admins')
        .select('status')
        .eq('email', userEmail)
        .maybeSingle();
      admin = (byEmail.data ?? null) as Record<string, unknown> | null;
    }

    const profileRole =
      typeof (profile as Record<string, unknown> | null)?.role === 'string'
        ? String((profile as Record<string, unknown>).role).trim().toUpperCase()
        : '';
    if (profileRole === 'ADMIN' || isApprovedAdminStatus(admin?.status)) {
      return { ...authUser, role: UserRole.ADMIN };
    }
    return authUser;
  };

  const finishLogin = async (accessToken: string) => {
    await ensureAccountProfile(accessToken);
    const meRes = await api.get<{ success: boolean; data: Record<string, unknown> }>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const authUser = await promoteApprovedSupabaseAdmin(accessToken, mapAuthUser(meRes.data.data));
    if (accountMode === 'ADMIN' && authUser.role !== UserRole.ADMIN) {
      getSupabaseBrowserClient()
        ?.auth.signOut()
        .catch(() => {});
      throw new Error('This admin account is not approved yet. In Supabase, set public.admins.status to ACTIVE and public.profiles.role to ADMIN.');
    }
    setSession(accessToken, authUser);

    toast.success(authUser.role === UserRole.ADMIN ? 'Welcome back, admin' : 'Welcome back');
    const next = searchParams.get('next');
    router.push(
      next && next.startsWith('/')
        ? next
        : authUser.role === UserRole.ADMIN
          ? '/dashboard/admin'
          : '/dashboard/map'
    );
  };

  const loginWithBackend = async () => {
    const res = await api.post<{ success: boolean; data: AuthTokenResponse }>('/auth/login', {
      email: email.trim(),
      password,
    });
    const token = res.data.data?.accessToken;
    if (!token) throw new Error('Login succeeded but no access token was returned.');
    await finishLogin(token);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        await loginWithBackend();
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error('Supabase client not available');

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw new Error(error.message || 'Sign in failed');
      }
      if (!data.session?.access_token) {
        throw new Error('Sign in failed. Please try again.');
      }
      await finishLogin(data.session.access_token);
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
          return String(
            (err as { response?: { data?: { error?: string } } }).response?.data?.error || ''
          );
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
    <div className="min-h-screen bg-[#f7f4ee] px-4 py-6 text-[#27251f] sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <div className="max-w-md">
            <div className="mb-8 flex h-12 w-12 items-center justify-center border border-[#d8d1c4] bg-[#fbfaf7]">
              <ShieldCheck className="h-6 w-6 text-[#7d2f25]" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.34em] text-[#7d2f25]">
              Risk Radar
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-tight text-[#27251f]">
              Clear access for everyday safety.
            </h1>
            <p className="mt-6 text-base leading-8 text-[#6d675c]">
              Sign in once. Citizens go to the map and reports. Approved admins are recognized
              automatically and taken to the operations dashboard.
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[480px]">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#7d2f25]">
              {accountMode === 'ADMIN' ? 'Admin entry' : 'Citizen entry'}
            </p>
            <h2 className="mt-3 text-4xl font-semibold text-[#27251f]">Welcome back</h2>
            <p className="mt-3 text-sm leading-6 text-[#716b61]">
              {accountMode === 'ADMIN'
                ? 'Admin access opens after your application is approved.'
                : 'Primary access for reports, SOS, live map, and neighborhood awareness.'}
            </p>
          </div>

          <div className="border border-[#ded6c8] bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(39,37,31,0.08)] sm:p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8b8377]" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8b8377]" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-12 w-full rounded-none bg-[#27251f] text-sm font-medium text-[#fbfaf7] shadow-none hover:bg-[#3a372f]"
                disabled={loading}
              >
                <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-7 flex flex-col gap-3 text-sm text-[#716b61] sm:flex-row sm:items-center sm:justify-between">
              <Link href="/auth/signup" className="font-medium text-[#27251f] hover:text-[#7d2f25]">
                Create account
              </Link>
              <button
                type="button"
                onClick={() => setAccountMode(accountMode === 'ADMIN' ? 'USER' : 'ADMIN')}
                className="text-left font-medium text-[#7d2f25] hover:text-[#27251f] sm:text-right"
              >
                {accountMode === 'ADMIN' ? 'Use citizen access' : 'Admin access'}
              </button>
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-[#817a70]">
            Admin approval is checked quietly after sign-in.
          </p>
        </div>
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
