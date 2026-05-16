FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY backend/package.json backend/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_URL_LOCAL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_CRIME_TABLE
ARG NEXT_PUBLIC_NEARBY_ALERT_RADIUS_KM=10
ARG BACKEND_PROXY_TARGET

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL_LOCAL=$NEXT_PUBLIC_API_URL_LOCAL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_CRIME_TABLE=$NEXT_PUBLIC_SUPABASE_CRIME_TABLE
ENV NEXT_PUBLIC_NEARBY_ALERT_RADIUS_KM=$NEXT_PUBLIC_NEARBY_ALERT_RADIUS_KM
ENV BACKEND_PROXY_TARGET=$BACKEND_PROXY_TARGET

RUN pnpm --filter @risk-radar/web build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app /app

EXPOSE 3000

CMD ["pnpm", "--dir", "apps/web", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
