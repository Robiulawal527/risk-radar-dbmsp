# Risk Radar v2.0

**See the risk. Avoid danger. Make meaningful connections.**

Bangladesh's most advanced real-time crime intelligence and community safety platform.

## Features
- Live interactive crime heatmap with Leaflet + heat layers
- Advanced analytics with beautiful Recharts visualizations
- One-tap SOS with live location sharing
- AI-powered Social Radar for trusted community connections
- Community rankings (champions & most wanted)
- Instant incident reporting
- Fully glassmorphism dark UI with smooth animations

## Tech Stack
- Next.js 14 + TypeScript
- Tailwind + Framer Motion + Glassmorphism
- TanStack Query + Sonner toasts
- Leaflet + Recharts
- Zustand for state

## Getting Started

```bash
pnpm install
pnpm --filter @risk-radar/web dev
```

Open http://localhost:3000

## Deploy on Vercel

1. In the Vercel project, set **Root Directory** to **`apps/web`** (required for this monorepo).
2. Do **not** set a custom **Output Directory**; Next.js uses the framework default (`.next` is handled by Vercel).
3. Set `NEXT_PUBLIC_API_URL` to the Railway backend URL, including `/api`.
4. Set the Supabase browser variables from `apps/web/.env.example`.
5. If previews show **403 Forbidden**, turn off **Deployment Protection** under Project → Settings → Deployment Protection (or log in with Vercel when prompted).

See `../../DEPLOYMENT.md` for the full Vercel + Railway + Supabase checklist.

Demo login: demo@riskradar.local / any password

## Production Ready
- Fully responsive
- Dark futuristic glassmorphism design
- All original features preserved + enhanced
- No unnecessary cards — clean, powerful command center
- Ready for real backend integration (Supabase/Firebase ready)

Built with ❤️ for a safer Bangladesh.
