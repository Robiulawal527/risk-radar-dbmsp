# Docker Deployment

Risk Radar is a pnpm monorepo with three Docker services:

- `web`: production Next.js dashboard at `http://localhost:3000`
- `mobile`: Expo dev server for the React Native app at `http://localhost:8081`
- `backend`: optional Express API at `http://localhost:3001/api`

Native iOS/Android release builds still need Expo/EAS. Docker runs the Expo development server so phones can scan the QR code and test the mobile app against the same Supabase project.

## 1. Prepare environment

```bash
cp docker.env.example .env.docker
```

Fill `.env.docker` with the same public Supabase values used by the apps:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

For the backend container, also fill these private values:

- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

Use the Supabase hosted Postgres connection string for `DATABASE_URL`. The compose stack intentionally does not start a local Postgres container because this app depends on Supabase Auth tables and realtime policies.

## 2. Run web and mobile

```bash
pnpm docker:web-mobile
```

Open the web app:

```text
http://localhost:3000
```

Watch the Expo QR code:

```bash
docker compose --env-file .env.docker logs -f mobile
```

The Docker env example defaults to `EXPO_HOST=tunnel` because LAN mode usually advertises a private container IP that phones cannot reach. If the tunnel service times out, the mobile container automatically falls back to LAN mode instead of crashing. For reliable LAN fallback, set `REACT_NATIVE_PACKAGER_HOSTNAME` to your computer's LAN IP before starting the mobile service.

## 3. Run the full stack with backend

After adding the private backend secrets:

```bash
pnpm docker:full
```

For the web container to proxy to the Docker backend, use:

```env
NEXT_PUBLIC_API_URL=http://backend:3001/api
BACKEND_PROXY_TARGET=http://backend:3001
```

For a physical phone, do not use `backend`, `localhost`, or `127.0.0.1` as the Expo API host because the phone cannot resolve Docker service names and `localhost` means the phone itself. Use your deployed backend URL, or your computer LAN IP:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api
EXPO_PUBLIC_API_URL_LOCAL=http://192.168.x.x:3001/api
```

## 4. Stop containers

```bash
pnpm docker:down
```
