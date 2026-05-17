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
import { mapAuthUser, type AuthTokenResponse } from '@/lib/auth-session';
import { UserRole } from '@/lib/types';

type AccountMode = 'USER' | 'ADMIN';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<AccountMode>('USER');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setSession } = useAuthStore();

  const ensureAdminProfile = async (accessToken: string) => {
    if (accountMode !== 'ADMIN') return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    const userEmail = data.user?.email ?? email.trim();
    if (!userId) return;
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        full_name: name.trim(),
        role: UserRole.ADMIN,
        updated_at: new Date().toISOString(),
      } as never)
      .throwOnError();
    await supabase
      .from('admins')
      .upsert({
        id: userId,
        email: userEmail,
        name: name.trim(),
        status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      } as never)
      .throwOnError();
  };

  const finishSignup = async (accessToken: string) => {
    await ensureAdminProfile(accessToken);
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
            role: accountMode,
          },
        },
      });

      if (error) {
        await signupWithBackend();
        return;
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
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] p-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-700 ring-1 ring-white/10">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Join the movement</h1>
          <p className="mt-2 text-slate-400">
            Create your account to report and receive area alerts
          </p>
        </div>

        <div className="glass-panel">
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">
                ACCOUNT TYPE
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
                {(['USER', 'ADMIN'] as AccountMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAccountMode(mode)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      accountMode === mode
                        ? 'bg-white text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {mode === 'ADMIN' ? 'Admin' : 'User'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">FULL NAME</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">EMAIL</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs tracking-widest text-slate-400">
                CREATE PASSWORD
              </label>
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
              {loading
                ? 'CREATING ACCOUNT…'
                : accountMode === 'ADMIN'
                  ? 'CREATE ADMIN ACCOUNT'
                  : 'CREATE FREE ACCOUNT'}
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
