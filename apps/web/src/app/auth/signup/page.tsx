'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, LockKeyhole, Mail, Shield, UserRound, Wrench } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { mapAuthUser, type AuthTokenResponse } from '@/lib/auth-session';
import { PHONE_HINT, requireValidPhoneNumber } from '@/lib/validation';

type AccountMode = 'USER' | 'ADMIN';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<AccountMode>('USER');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setSession } = useAuthStore();

  const ensureAccountProfile = async (accessToken: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    const userEmail = data.user?.email ?? email.trim();
    if (!userId) return;
    const now = new Date().toISOString();
    const profileWrite = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        full_name: name.trim(),
        phone: requireValidPhoneNumber(phone) || null,
        role: accountMode,
        updated_at: now,
      } as never)
      .select('id')
      .maybeSingle();

    let adminWriteError: unknown = null;
    if (accountMode === 'ADMIN') {
      const adminWrite = await supabase
        .from('admins')
        .upsert({
          id: userId,
          email: userEmail,
          name: name.trim(),
          status: 'ACTIVE',
          updated_at: now,
        } as never)
        .select('id')
        .maybeSingle();
      adminWriteError = adminWrite.error;
    }

    if (profileWrite.error || adminWriteError) {
      toast.warning('Profile sync pending', {
        description:
          accountMode === 'ADMIN'
            ? 'The account was created. Check the profiles/admins table policies so admin access is persisted.'
            : 'The account was created. Check the profiles table policy if profile data does not appear.',
      });
    }
  };

  const finishSignup = async (accessToken: string) => {
    await ensureAccountProfile(accessToken);
    const meRes = await api.get<{ success: boolean; data: Record<string, unknown> }>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const authUser = mapAuthUser(meRes.data.data);
    setSession(accessToken, authUser);
    toast.success(accountMode === 'ADMIN' ? 'Admin account created' : 'Account created');
    router.push(accountMode === 'ADMIN' ? '/dashboard/admin' : '/dashboard/map');
  };

  const signupWithBackend = async () => {
    const res = await api.post<{ success: boolean; data: AuthTokenResponse }>('/auth/signup', {
      name: name.trim(),
      email: email.trim(),
      phone: requireValidPhoneNumber(phone) || undefined,
      password,
      role: accountMode,
    });
    const token = res.data.data?.accessToken;
    if (!token) throw new Error('Signup succeeded but no access token was returned.');
    await finishSignup(token);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    let normalizedPhone = '';
    try {
      normalizedPhone = requireValidPhoneNumber(phone);
      if (phone.trim() && phone !== normalizedPhone) setPhone(normalizedPhone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : PHONE_HINT);
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        await signupWithBackend();
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
            phone: normalizedPhone || undefined,
            role: accountMode,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Could not create account');
      }

      // If email confirmation is enabled, there may be no session yet.
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        toast.success('Account created', {
          description:
            accountMode === 'ADMIN'
              ? 'Please confirm your email, then sign in with the Admin option.'
              : 'Please check your email to confirm your account, then sign in.',
        });
        router.push('/auth/login');
        return;
      }

      await finishSignup(accessToken);
    } catch (err: unknown) {
      const msg = (() => {
        if (err && typeof err === 'object' && 'response' in err) {
          return String(
            (err as { response?: { data?: { error?: string } } }).response?.data?.error || ''
          );
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
    <div className="min-h-screen bg-[#070b14] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400/15 ring-1 ring-teal-300/25">
              <Shield className="h-7 w-7 text-teal-200" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-200">
              Risk Radar
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white">
              Create a safer account in under a minute.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Sign up as a general user to report incidents, receive nearby alerts, and use SOS
              tools. Admin access is available only when you intentionally choose it.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                General users are the primary flow.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                Phone numbers are saved in 11-digit local format for SOS and contact workflows.
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-xl">
          <div className="mb-7 text-center lg:text-left">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400/15 ring-1 ring-teal-300/25 lg:mx-0">
              <Shield className="h-7 w-7 text-teal-200" />
            </div>
            <h2 className="text-4xl font-black tracking-tight text-white">Create account</h2>
            <p className="mt-2 text-slate-400">General user is selected by default.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-xs tracking-widest text-slate-400">
                    ACCOUNT TYPE
                  </label>
                  <span className="text-[10px] uppercase tracking-wide text-teal-300">
                    User first
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 sm:grid-cols-2">
                  {(['USER', 'ADMIN'] as AccountMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAccountMode(mode)}
                      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        accountMode === mode
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {mode === 'ADMIN' ? (
                        <Wrench className="h-4 w-4" />
                      ) : (
                        <UserRound className="h-4 w-4" />
                      )}
                      {mode === 'ADMIN' ? 'Admin account' : 'General user'}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  General user is the default. Choose admin only if you need operations access.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs tracking-widest text-slate-400">
                  FULL NAME
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Your real name"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Used on reports so admins can identify the account owner.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-slate-400">EMAIL</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-10"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Used for login, password recovery, and account notifications.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-slate-400">
                  PHONE NUMBER
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="01712345678"
                  maxLength={14}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Optional. {PHONE_HINT} Used for SOS/contact workflows.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-slate-400">
                  CREATE PASSWORD
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="pl-10"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Minimum 8 characters. Use a password you do not reuse elsewhere.
                </p>
              </div>

              <Button type="submit" className="premium-button mt-4 h-12 w-full" disabled={loading}>
                {loading
                  ? 'CREATING ACCOUNT…'
                  : accountMode === 'ADMIN'
                    ? 'CREATE ADMIN ACCOUNT'
                    : 'CREATE FREE ACCOUNT'}
              </Button>
            </form>

            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Admin signup should be used only by operators who need dashboard access.
            </div>

            <div className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-teal-400 hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
