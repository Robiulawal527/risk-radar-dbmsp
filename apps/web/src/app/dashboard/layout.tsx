'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Map, BarChart3, AlertTriangle, Users, Award, Settings, LogOut, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { motion } from 'framer-motion';
import { useCrimeAlertNotifications } from '@/hooks/use-crime-alert-notifications';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard/map', label: 'Live Heatmap', icon: Map },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/report', label: 'Report Incident', icon: AlertTriangle },
  { href: '/dashboard/sos', label: 'Emergency SOS', icon: Shield },
  { href: '/dashboard/social-radar', label: 'Social Radar', icon: Users },
  { href: '/dashboard/rankings', label: 'Rankings', icon: Award },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated, accessToken } = useAuthStore();
  // SSR / static prerender: zustand `persist` API is not attached on the server — never read it in useState init.
  const [hydrated, setHydrated] = useState(false);
  const { unread } = useCrimeAlertNotifications();

  useEffect(() => {
    const api = useAuthStore.persist;
    if (!api) {
      setHydrated(true);
      return;
    }
    const done = () => setHydrated(true);
    if (api.hasHydrated()) done();
    return api.onFinishHydration(done);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !accessToken) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/dashboard/map')}`);
    }
  }, [hydrated, isAuthenticated, accessToken, router, pathname]);

  if (!hydrated || !isAuthenticated || !accessToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#070b14] text-slate-400">
        <div className="text-center text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#070b14]">
      <div className="hidden w-72 flex-col border-r border-white/10 glass-strong lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-indigo-700 ring-1 ring-white/10">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-black tracking-tighter">RISK RADAR</div>
            <div className="-mt-1 text-[9px] text-teal-300">SAFETY OS v2.0</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="px-4 py-2 text-xs font-semibold tracking-widest text-slate-500">COMMAND CENTER</div>

          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-link group ${isActive ? 'active' : ''}`}>
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-teal-300' : 'text-slate-400 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div layoutId="activeIndicator" className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 px-4">
            <div className="glass rounded-2xl p-4 text-xs">
              <div className="flex items-center gap-2 text-emerald-400">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                CONNECTED
              </div>
              <div className="mt-2 text-slate-400">Live data from your configured API and database.</div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-600 text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user?.name || 'Account'}</div>
              <div className="truncate text-xs text-slate-400">{user?.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                getSupabaseBrowserClient()?.auth.signOut().catch(() => {});
                logout();
                window.location.href = '/';
              }}
              className="shrink-0 text-slate-400 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="glass z-40 flex h-16 items-center justify-between border-b border-white/10 px-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <Shield className="h-6 w-6 text-teal-400" />
              <span className="font-bold">Risk Radar</span>
            </div>
            <div className="hidden text-sm text-slate-400 lg:block">
              Dhaka, Bangladesh •{' '}
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative" type="button" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <div className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold">
                  {unread > 9 ? '9+' : unread}
                </div>
              ) : null}
            </Button>

            <div className="h-8 w-px bg-white/10" />

            <Link href="/dashboard/settings">
              <div className="flex items-center gap-2 text-sm transition-colors hover:text-teal-300">
                <div className="text-right">
                  <div className="font-medium">{user?.name || 'Account'}</div>
                  <div className="text-xs text-emerald-400">Online</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#070b14] p-8">
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  pathname === item.href
                    ? 'border-teal-500/40 bg-teal-950/30 text-teal-200'
                    : 'border-white/10 bg-white/5 text-slate-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
