'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Shield,
  MapPin,
  TrendingUp,
  Bell,
  Navigation,
  Users,
  Award,
  ArrowRight,
  Play,
  HeartHandshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Feature = {
  icon: typeof MapPin;
  title: string;
  desc: string;
  iconWrapClass: string;
  iconClass: string;
};

const features: Feature[] = [
  {
    icon: MapPin,
    title: 'Live crime heatmap',
    desc: 'Interactive Dhaka heatmaps powered by real reports and risk signals.',
    iconWrapClass:
      'bg-gradient-to-br from-cyan-400/15 to-teal-900/20 text-cyan-300 ring-1 ring-cyan-400/25',
    iconClass: 'text-cyan-300',
  },
  {
    icon: TrendingUp,
    title: 'Advanced analytics',
    desc: 'Severity trends, category breakdowns, and area risk scores.',
    iconWrapClass:
      'bg-gradient-to-br from-sky-400/15 to-indigo-900/20 text-sky-300 ring-1 ring-sky-400/20',
    iconClass: 'text-sky-300',
  },
  {
    icon: Bell,
    title: 'Instant alerts',
    desc: 'Notifications for high-risk zones and incidents near you.',
    iconWrapClass:
      'bg-gradient-to-br from-amber-400/12 to-orange-900/15 text-amber-200 ring-1 ring-amber-400/20',
    iconClass: 'text-amber-200',
  },
  {
    icon: Navigation,
    title: 'Smart safety routes',
    desc: 'Safer path suggestions based on recent incident density.',
    iconWrapClass:
      'bg-gradient-to-br from-teal-400/15 to-slate-900/40 text-teal-200 ring-1 ring-teal-400/20',
    iconClass: 'text-teal-200',
  },
  {
    icon: Shield,
    title: 'One-tap SOS',
    desc: 'Location-aware emergency flow with quick contacts.',
    iconWrapClass:
      'bg-gradient-to-br from-indigo-500/20 to-slate-950/80 text-indigo-200 ring-1 ring-indigo-400/25',
    iconClass: 'text-indigo-200',
  },
  {
    icon: Users,
    title: 'Social radar',
    desc: 'Connect with verified community safety champions.',
    iconWrapClass:
      'bg-gradient-to-br from-violet-400/15 to-fuchsia-900/20 text-violet-200 ring-1 ring-violet-400/25',
    iconClass: 'text-violet-200',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b14] text-white">
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 glass">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-indigo-700 ring-1 ring-white/10 sm:h-11 sm:w-11">
              <Shield className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 text-left">
              <div className="truncate text-lg font-black tracking-tighter sm:text-2xl">RISK RADAR</div>
              <div className="-mt-0.5 text-[9px] tracking-[2px] text-teal-300/90 sm:text-[10px] sm:tracking-[3px]">
                BANGLADESH SAFETY OS
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link href="#features" className="transition-colors hover:text-teal-300">
              Features
            </Link>
            <Link href="#impact" className="transition-colors hover:text-teal-300">
              Impact
            </Link>
            <Link href="#community" className="transition-colors hover:text-teal-300">
              Community
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 sm:size-default">
                Login
              </Button>
            </Link>
            <Link href="/auth/signup" className="inline-flex">
              <Button size="sm" className="premium-button group sm:size-default">
                <span className="hidden sm:inline">Get started free</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5 sm:ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center pt-24 sm:pt-20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(56,189,248,0.11)_0.9px,transparent_1px)] bg-[length:5px_5px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(79,70,229,0.22),transparent)]"
          aria-hidden
        />

        <div className="container relative z-10 px-4 pb-16 text-center sm:px-6">
          <motion.div
            className="text-white"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto mb-8 inline-flex max-w-full items-center gap-2 rounded-full border border-teal-500/25 bg-teal-950/25 px-3 py-1.5 text-xs text-slate-200 sm:mb-10 sm:text-sm">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
              </span>
              <span className="truncate">Community safety intelligence for Dhaka and beyond</span>
            </div>

            <h1 className="mx-auto max-w-4xl text-pretty font-black leading-[1.12] tracking-tight sm:leading-[1.08]">
              <span className="block bg-gradient-to-br from-slate-50 via-sky-100 to-cyan-200 bg-clip-text text-3xl text-transparent sm:text-5xl md:text-6xl lg:text-7xl">
                See the risk, avoid danger.
              </span>
              <span className="mt-3 block text-2xl font-bold text-slate-300 sm:mt-5 sm:text-4xl md:text-5xl lg:text-6xl">
                Build <span className="neon-text">meaningful connections</span>.
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-base text-zinc-400 sm:mt-10 sm:text-lg md:text-xl">
              Bangladesh&apos;s real-time safety platform for awareness, reporting, and coordinated response.
            </p>
          </motion.div>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/dashboard/map" className="sm:inline-flex">
              <Button size="lg" className="premium-button group h-12 w-full px-8 text-base sm:h-14 sm:w-auto sm:px-10 sm:text-lg">
                Launch live map
                <Play className="ml-2 h-5 w-5 sm:ml-3" />
              </Button>
            </Link>
            <Link href="/auth/signup" className="sm:inline-flex">
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full border-white/20 px-8 text-base text-slate-100 hover:border-teal-400/40 hover:bg-teal-950/20 sm:h-14 sm:w-auto sm:text-lg"
              >
                Join the movement
              </Button>
            </Link>
          </div>

          <div className="mt-14 flex justify-center sm:mt-16">
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="flex flex-col items-center text-[10px] tracking-widest text-slate-500 sm:text-xs"
            >
              SCROLL TO EXPLORE
              <div className="mt-1 h-px w-8 bg-white/30" />
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-8 right-4 hidden max-w-[200px] rounded-3xl border border-teal-500/15 glass p-4 text-sm xl:block">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-teal-500/15 p-2">
              <Award className="h-5 w-5 text-teal-300" />
            </div>
            <div>
              <div className="font-semibold">Safety awareness</div>
              <div className="text-xs text-slate-400">Built for Dhaka metro</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="container mx-auto scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-12 text-center sm:mb-16">
          <div className="mb-3 text-xs font-semibold tracking-[0.2em] text-teal-400/95 sm:text-sm sm:tracking-[3px]">
            POWERED BY COMMUNITY + DATA
          </div>
          <h2 className="text-3xl font-black tracking-tighter sm:text-5xl md:text-6xl">
            Everything you need
            <br />
            to stay informed
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="glass-card group flex flex-col"
              >
                <div
                  className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 sm:mb-6 sm:h-16 sm:w-16 ${feature.iconWrapClass}`}
                >
                  <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${feature.iconClass}`} />
                </div>
                <h3 className="mb-2 text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">{feature.title}</h3>
                <p className="flex-1 text-base text-slate-400 sm:text-lg">{feature.desc}</p>
                <div className="mt-5 flex items-center text-sm text-teal-400 transition-all group-hover:gap-2">
                  Explore in app
                  <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section id="impact" className="scroll-mt-24 border-y border-indigo-950/50 bg-gradient-to-b from-indigo-950/25 via-slate-950/40 to-transparent py-14 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4 md:gap-8">
            {[
              { number: '24/7', label: 'Map coverage' },
              { number: '47k+', label: 'Community goal' },
              { number: '< 2 min', label: 'Report flow' },
              { number: '1 place', label: 'SOS + radar' },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1 sm:space-y-2">
                <div className="text-3xl font-black tracking-tighter text-white sm:text-5xl md:text-6xl">
                  {stat.number}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 sm:text-sm sm:tracking-[2px]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="community" className="container mx-auto scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 glass p-8 text-center sm:p-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-teal-600/20 ring-1 ring-white/10">
            <HeartHandshake className="h-8 w-8 text-violet-200" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter sm:text-4xl md:text-5xl">Community-first safety</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            Verified reports, transparent hotspots, and tools that help neighbors watch out for each other—without
            replacing emergency services.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup">
              <Button className="premium-button">Create a free account</Button>
            </Link>
            <Link href="/dashboard/social-radar">
              <Button variant="outline" className="border-violet-500/30 bg-violet-950/10 hover:border-teal-400/35 hover:bg-teal-950/15">
                Open social radar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 sm:mb-8 sm:h-20 sm:w-20">
            <Shield className="h-8 w-8 text-teal-400 sm:h-10 sm:w-10" />
          </div>

          <h2 className="text-3xl font-black tracking-tighter sm:text-5xl md:text-6xl">
            Ready to make
            <br />
            your city safer?
          </h2>
          <p className="mt-5 text-lg text-slate-400 sm:mt-6 sm:text-2xl">
            Start with the live map, report incidents responsibly, and keep your circle informed.
          </p>

          <div className="mt-8 sm:mt-10">
            <Link href="/auth/signup">
              <Button size="lg" className="premium-button h-14 px-10 text-lg sm:h-16 sm:px-16 sm:text-xl">
                Get started free
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500 sm:mt-4">No credit card required · Built for Bangladesh</p>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-xs text-slate-500 sm:py-12 sm:text-sm">
        <div className="container mx-auto px-4 sm:px-6">
          © {new Date().getFullYear()} Risk Radar — Community safety intelligence.
          <div className="mt-2 text-slate-600">Use official channels for life-threatening emergencies.</div>
        </div>
      </footer>
    </div>
  );
}
