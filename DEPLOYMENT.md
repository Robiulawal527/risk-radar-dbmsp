Risk Radar BD
See the risk, avoid danger and build meaningful connections.
# Risk Radar Deployment

Use this checklist for the production split:

- Frontend: Vercel, project root `apps/web`
- Backend: Railway, repo root
- Database/auth/storage: Supabase

## Supabase

Run the SQL migrations in `packages/database/migrations` in order, including:

- `009_disable_supabase_auth_profile_triggers.sql`
- `010_admin_applications.sql`

Create a public storage bucket named `admin-photos` if admin photo uploads should use storage URLs instead of the built-in data URL fallback.

## Railway Backend

Railway reads `railway.json` from the repo root.

Required variables:

```bash
DATABASE_URL=postgresql://...supabase.../postgres?sslmode=require
JWT_SECRET=<strong random value>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ALLOWED_ORIGINS=https://riskradarbd.vercel.app
NEARBY_ALERT_RADIUS_KM=10
```

Railway should build with:

```bash
pnpm --filter @risk-radar/backend... build
```

Railway should start with:

```bash
pnpm --filter @risk-radar/backend start
```

Health check:

```text
/api/health
```

## Vercel Frontend

Set Vercel project root to:

```text
apps/web
```

Required variables:

```bash
NEXT_PUBLIC_API_URL=https://<your-railway-service>.up.railway.app/api
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key, optional if anon key is set>
NEXT_PUBLIC_NEARBY_ALERT_RADIUS_KM=10
NEXT_PUBLIC_SUPABASE_CRIME_TABLE=crimes
```

Optional server-only override:

```bash
BACKEND_PROXY_TARGET=https://<your-railway-service>.up.railway.app
```

The frontend calls its own `/api/backend/*` routes, and those routes proxy to Railway using `NEXT_PUBLIC_API_URL` or `BACKEND_PROXY_TARGET`.

## Admin Approval

Approving an admin requires both app-level approval fields:

```sql
update public.admins
set status = 'ACTIVE', reviewed_at = now(), updated_at = now()
where email = 'admin@example.com';

update public.profiles
set role = 'ADMIN', updated_at = now()
where email = 'admin@example.com';
```

The admin dashboard approval button performs both updates when RLS policies from the latest migrations are applied.
