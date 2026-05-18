'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  Camera,
  FileBadge2,
  GraduationCap,
  LockKeyhole,
  Mail,
  Phone,
  Shield,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { mapAuthUser, type AuthTokenResponse } from '@/lib/auth-session';
import {
  NID_HINT,
  PHONE_HINT,
  requireValidNidNumber,
  requireValidPhoneNumber,
} from '@/lib/validation';

type AccountMode = 'USER' | 'ADMIN';
const ADMIN_EDUCATION = "Bachelor's degree";

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nidNumber, setNidNumber] = useState('');
  const [educationField, setEducationField] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [accountMode, setAccountMode] = useState<AccountMode>('USER');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setSession } = useAuthStore();

  const readPhotoDataUrl = async (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read admin photo'));
      reader.readAsDataURL(file);
    });

  const uploadAdminPhoto = async (userId: string, file: File, fallbackDataUrl: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return fallbackDataUrl;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/application-photo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('admin-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) return fallbackDataUrl;
    const { data } = supabase.storage.from('admin-photos').getPublicUrl(path);
    return data.publicUrl || fallbackDataUrl;
  };

  const ensureAccountProfile = async (accessToken: string, adminPhotoUrl?: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser(accessToken);
    const userId = data.user?.id;
    const userEmail = data.user?.email ?? email.trim();
    if (!userId) return;
    const now = new Date().toISOString();
    const normalizedPhone = requireValidPhoneNumber(phone) || null;
    const normalizedNid = accountMode === 'ADMIN' ? requireValidNidNumber(nidNumber) : '';
    const profileWrite = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        full_name: name.trim(),
        phone: normalizedPhone,
        role: 'USER',
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
          phone: normalizedPhone,
          nid_number: normalizedNid,
          education: ADMIN_EDUCATION,
          education_field: educationField.trim(),
          photo_url: adminPhotoUrl ?? null,
          status: 'PENDING',
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
    let adminPhotoUrl = '';
    if (accountMode === 'ADMIN' && photoFile) {
      const dataUrl = await readPhotoDataUrl(photoFile);
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase
        ? await supabase.auth.getUser(accessToken)
        : { data: { user: null } };
      adminPhotoUrl = data.user?.id
        ? await uploadAdminPhoto(data.user.id, photoFile, dataUrl)
        : dataUrl;
    }
    await ensureAccountProfile(accessToken, adminPhotoUrl);
    if (accountMode === 'ADMIN') {
      await getSupabaseBrowserClient()
        ?.auth.signOut()
        .catch(() => {});
      toast.success('Admin application submitted', {
        description:
          'Your admin account is pending verification. You can sign in as admin after approval.',
      });
      router.push('/auth/login');
      return;
    }
    const meRes = await api.get<{ success: boolean; data: Record<string, unknown> }>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const authUser = mapAuthUser(meRes.data.data);
    setSession(accessToken, authUser);
    toast.success('Account created');
    router.push('/dashboard/map');
  };

  const signupWithBackend = async () => {
    const res = await api.post<{ success: boolean; data: AuthTokenResponse }>('/auth/signup', {
      name: name.trim(),
      email: email.trim(),
      phone: requireValidPhoneNumber(phone) || undefined,
      password,
      role: accountMode === 'ADMIN' ? 'USER' : accountMode,
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
      if (accountMode === 'ADMIN') {
        const normalizedNid = requireValidNidNumber(nidNumber);
        if (normalizedNid !== nidNumber) setNidNumber(normalizedNid);
        if (!educationField.trim()) throw new Error('Enter the bachelor field or subject.');
        if (!photoFile) throw new Error('Admin photo is required for verification.');
        if (!photoFile.type.startsWith('image/'))
          throw new Error('Admin photo must be an image file.');
        if (photoFile.size > 2_000_000) throw new Error('Admin photo must be 2 MB or smaller.');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : accountMode === 'ADMIN' ? NID_HINT : PHONE_HINT
      );
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
            role: accountMode === 'ADMIN' ? 'ADMIN_APPLICANT' : 'USER',
            adminStatus: accountMode === 'ADMIN' ? 'PENDING' : undefined,
            nidNumber: accountMode === 'ADMIN' ? requireValidNidNumber(nidNumber) : undefined,
            education: accountMode === 'ADMIN' ? ADMIN_EDUCATION : undefined,
            educationField: accountMode === 'ADMIN' ? educationField.trim() : undefined,
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
    <div className="min-h-screen bg-[#f7f4ee] px-4 py-6 text-[#27251f] sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <div className="max-w-md">
            <div className="mb-8 flex h-12 w-12 items-center justify-center border border-[#d8d1c4] bg-[#fbfaf7]">
              <Shield className="h-6 w-6 text-[#7d2f25]" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.34em] text-[#7d2f25]">
              Risk Radar
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-tight text-[#27251f]">
              Quiet tools for safer streets.
            </h1>
            <p className="mt-6 text-base leading-8 text-[#6d675c]">
              The citizen account is the main path: reports, SOS, live map, and nearby awareness.
              Admin access stays separate and opens only after review.
            </p>
            <div className="mt-10 grid gap-3 border-l border-[#d8d1c4] pl-5 text-sm leading-6 text-[#6d675c]">
              <span>11-digit phone format keeps SOS contact data clean.</span>
              <span>Admin applications require NID, bachelor education, and a photo.</span>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[520px]">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#7d2f25]">
              {accountMode === 'ADMIN' ? 'Admin application' : 'Citizen account'}
            </p>
            <h2 className="mt-3 text-4xl font-semibold text-[#27251f]">Create account</h2>
            <p className="mt-3 text-sm leading-6 text-[#716b61]">
              {accountMode === 'ADMIN'
                ? 'Submit your verification details. Approval is manual before access is active.'
                : 'Start as a citizen user. You can apply for admin access separately.'}
            </p>
          </div>

          <div className="border border-[#ded6c8] bg-[#fbfaf7] p-5 shadow-[0_24px_80px_rgba(39,37,31,0.08)] sm:p-8">
            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                  Name
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8b8377]" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your real name"
                    className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                  />
                </div>
              </div>
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
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8b8377]" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="01712345678"
                    maxLength={14}
                    className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                  />
                </div>
              </div>
              {accountMode === 'ADMIN' ? (
                <div className="border border-[#d8d1c4] bg-[#f2eee6] p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="border border-[#d0c5b6] bg-[#fbfaf7] p-2 text-[#7d2f25]">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-[#27251f]">Admin verification</div>
                      <p className="mt-1 text-xs leading-5 text-[#716b61]">
                        Admin accounts are submitted for review first. Access is activated only
                        after you or a super admin approves the application.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                        NID number
                      </label>
                      <div className="relative">
                        <FileBadge2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8b8377]" />
                        <Input
                          value={nidNumber}
                          onChange={(e) => setNidNumber(e.target.value)}
                          inputMode="numeric"
                          placeholder="10, 13, or 17 digits"
                          maxLength={17}
                          className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                          Education
                        </label>
                        <div className="relative">
                          <GraduationCap className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#8b8377]" />
                          <Input
                            value={ADMIN_EDUCATION}
                            disabled
                            className="h-12 rounded-none border border-[#d8d1c4] bg-[#ebe5dc] pl-10 text-[#27251f]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                          Field
                        </label>
                        <Input
                          value={educationField}
                          onChange={(e) => setEducationField(e.target.value)}
                          placeholder="e.g. CSE, BBA, English"
                          className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#7d766b]">
                        Admin photo
                      </label>
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-[#cfc5b8] bg-[#fffdf9] p-4 text-center transition hover:bg-white">
                        {photoPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoPreview}
                            alt="Admin applicant preview"
                            className="h-28 w-28 object-cover ring-1 ring-[#d8d1c4]"
                          />
                        ) : (
                          <span className="flex h-16 w-16 items-center justify-center border border-[#d8d1c4] bg-[#f7f4ee] text-[#7d766b]">
                            <Camera className="h-7 w-7" />
                          </span>
                        )}
                        <span className="text-sm font-medium text-[#27251f]">
                          Upload a clear face photo
                        </span>
                        <span className="text-xs text-[#716b61]">
                          JPG or PNG, up to 2 MB. This is reviewed before admin activation.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPhotoFile(file);
                            if (!file) {
                              setPhotoPreview('');
                              return;
                            }
                            const url = URL.createObjectURL(file);
                            setPhotoPreview(url);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
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
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="h-12 rounded-none border border-[#d8d1c4] bg-[#fffdf9] pl-10 text-[#27251f] placeholder:text-[#aaa196] focus-visible:border-[#27251f] focus-visible:ring-0"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-12 w-full rounded-none bg-[#27251f] text-sm font-medium text-[#fbfaf7] shadow-none hover:bg-[#3a372f]"
                disabled={loading}
              >
                <span>
                  {loading
                    ? 'Creating account...'
                    : accountMode === 'ADMIN'
                      ? 'Submit admin application'
                      : 'Create citizen account'}
                </span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-7 flex flex-col gap-3 text-sm text-[#716b61] sm:flex-row sm:items-center sm:justify-between">
              <Link href="/auth/login" className="font-medium text-[#27251f] hover:text-[#7d2f25]">
                Sign in
              </Link>
              <button
                type="button"
                onClick={() => setAccountMode(accountMode === 'ADMIN' ? 'USER' : 'ADMIN')}
                className="text-left font-medium text-[#7d2f25] hover:text-[#27251f] sm:text-right"
              >
                {accountMode === 'ADMIN' ? 'Create citizen account' : 'Apply for admin access'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
