FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

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

RUN pnpm --filter @risk-radar/types build \
  && pnpm --filter @risk-radar/config build \
  && pnpm --filter @risk-radar/database build \
  && pnpm --filter @risk-radar/backend build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app /app

EXPOSE 3001

CMD ["pnpm", "--filter", "@risk-radar/backend", "start"]
