/**
 * Vercel serverless: optional catch-all under `/api` so `/api`, `/api/health`,
 * `/api/auth/me`, etc. all hit the same Express app. (A plain `api/index.ts`
 * only handles `/api` exactly — subpaths would 404.)
 *
 * Local / long-running: use `pnpm dev` → `src/index.ts` (HTTP + Socket.IO).
 */
import '@risk-radar/config';
import { createApp } from '../dist/app.js';

const app = createApp();
export default app;
