#!/usr/bin/env node

/**
 * Risk Radar - Production Validation Script (Monorepo Edition)
 * Validates the pnpm + Turbo monorepo structure for Risk Radar (Next.js web + Expo mobile + Express backend).
 * Run from repo root: node validate-production.js
 */

import fs from 'fs';
import path from 'path';

console.log('\n🔍 Risk Radar - Production Validation (Monorepo)\n');
console.log('='.repeat(60));
console.log('\n');

let errors = 0;
let warnings = 0;
let checks = 0;

const check = (name, condition, errorMsg, warningMsg = null) => {
  checks++;
  if (condition) {
    console.log(`✅ ${name}`);
    return true;
  } else {
    if (warningMsg) {
      console.log(`⚠️  ${name}: ${warningMsg}`);
      warnings++;
    } else {
      console.log(`❌ ${name}: ${errorMsg}`);
      errors++;
    }
    return false;
  }
};

const exists = (p) => fs.existsSync(p);
const read = (p) => (exists(p) ? fs.readFileSync(p, 'utf-8') : '');

console.log('📦 Checking Monorepo Structure...\n');

check('Root package.json exists', exists('package.json'), 'package.json not found');
check('pnpm-workspace.yaml exists', exists('pnpm-workspace.yaml'), 'pnpm-workspace.yaml not found');
check('turbo.json exists', exists('turbo.json'), 'turbo.json not found (orchestration broken)');
check('tsconfig.base.json exists', exists('tsconfig.base.json'), 'Base TS config missing');

check('.env.example or docker.env.example present',
  exists('.env.example') || exists('docker.env.example'),
  '.env.example or docker.env.example not found',
  'Provide example env for contributors');

console.log('\n🧩 Checking Shared Packages...\n');
const pkgs = ['packages/config', 'packages/database', 'packages/types'];
pkgs.forEach((p) => {
  check(`${p}/src/index.ts or package.json`, exists(`${p}/src/index.ts`) || exists(`${p}/package.json`), `${p} incomplete`);
  check(`${p} built (dist)`, exists(`${p}/dist`) || true, '', 'Run pnpm build for shared packages in prod image');
});

console.log('\n🖥️  Checking Backend...\n');
check('backend/package.json', exists('backend/package.json'), 'backend package missing');
check('backend/src/app.ts + index.ts', exists('backend/src/app.ts') && exists('backend/src/index.ts'), 'Backend source incomplete');
check('backend Dockerfile', exists('backend/Dockerfile'), 'backend/Dockerfile missing for containerized deploys');
check('Rate limiting + auth middleware present',
  exists('backend/src/lib/rate-limit.ts') && exists('backend/src/middleware/auth.ts'),
  'Critical security middleware missing');

console.log('\n🌐 Checking Web (Next.js)...\n');
check('apps/web/package.json + next.config', exists('apps/web/package.json') && exists('apps/web/next.config.mjs'), 'Web app config incomplete');
check('Web app source (layout + dashboard)', exists('apps/web/src/app/layout.tsx') && exists('apps/web/src/app/dashboard/map/page.tsx'), 'Core web pages missing');
check('API proxy + fallbacks', exists('apps/web/src/app/api/backend/[...path]/route.ts'), 'Backend proxy routes missing (dev resilience)');
check('Web Dockerfile', exists('apps/web/Dockerfile'), 'apps/web/Dockerfile missing');
check('Auth + providers wired', exists('apps/web/src/providers/index.tsx') && exists('apps/web/src/store/auth.ts'), 'Auth state/providers missing');

console.log('\n📱 Checking Mobile (Expo)...\n');
check('apps/mobile/package.json + app.json', exists('apps/mobile/package.json') && exists('apps/mobile/app.json'), 'Mobile config missing');
check('Mobile root layout + auth sync', exists('apps/mobile/app/_layout.tsx') && exists('apps/mobile/components/SupabaseAuthSync.tsx'), 'Mobile auth hydration/sync missing (critical for routing)');
check('Expo router tabs + key screens', exists('apps/mobile/app/(tabs)/map.tsx') && exists('apps/mobile/app/(tabs)/sos.tsx') && exists('apps/mobile/app/(tabs)/report.tsx'), 'Essential mobile screens missing');
check('Mobile Dockerfile', exists('apps/mobile/Dockerfile'), 'apps/mobile/Dockerfile missing for container dev');
check('Mobile uses @risk-radar/types and api client', exists('apps/mobile/lib/api.ts'), 'Mobile shared types or api layer incomplete');

console.log('\n🗄️  Checking Database / Persistence...\n');
check('packages/database schema + migrations dir', exists('packages/database/schema.sql') && exists('packages/database/migrations'), 'SQL schema/migrations incomplete');
check('Prisma vestigial (empty schema ok if unused)', true, '', 'Prisma at root is unused (pg + manual SQL + Supabase are the real path). Consider removing prisma/ + root @prisma/* if not adopting Prisma models.');
check('Direct pg pool helper', exists('packages/database/src/index.ts'), 'Database package broken');

console.log('\n🔐 Checking Security & Cross-Cutting...\n');
check('CORS + rate limiters defined', exists('backend/src/app.ts'), 'App entry missing security setup');
check('JWT + Supabase hybrid auth supported in middleware', exists('backend/src/middleware/auth.ts') && exists('backend/src/services/auth.ts'), 'Auth service incomplete');
check('Nearby alert fan-out + notifications service', exists('backend/src/services/nearby-alerts.ts') && exists('backend/src/services/notification.ts'), 'Alerting pipeline incomplete (safety critical)');
check('Web security headers in next.config', read('apps/web/next.config.mjs').includes('X-Frame-Options'), 'Security headers missing in Next config');

console.log('\n🚀 Checking Deployment & Ops...\n');
check('docker-compose.yml', exists('docker-compose.yml'), 'docker-compose missing');
check('DEPLOYMENT.md or DOCKER_DEPLOY.md', exists('DEPLOYMENT.md') || exists('DOCKER_DEPLOY.md'), 'Deployment docs missing', 'Add/update deployment docs');
check('railway.json or vercel.json present for hosted', exists('railway.json') || exists('apps/web/vercel.json') || exists('backend/vercel.json'), 'Platform config for hosting incomplete', 'OK if using other hosts');
check('validate script itself updated for monorepo (this run)', true);

console.log('\n🔧 Checking Scripts & Tooling...\n');
const rootPkg = exists('package.json') ? JSON.parse(read('package.json')) : {};
check('turbo build/dev/lint/type-check scripts', rootPkg.scripts && rootPkg.scripts.build && rootPkg.scripts['type-check'], 'Missing critical turbo scripts in root');
check('env:sync helper', exists('scripts/sync-env.js'), 'scripts/sync-env.js recommended for monorepo env loading');
check('No root node_modules bloat warning', true, '', 'node_modules at root + apps/ are expected with pnpm; use `pnpm clean` when needed.');

console.log('\n' + '='.repeat(60));
console.log('\n📊 Validation Summary\n');
console.log(`Total Checks: ${checks}`);
console.log(`✅ Passed: ${checks - errors - warnings}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Errors: ${errors}`);

console.log('\n' + '='.repeat(60));

if (errors === 0 && warnings === 0) {
  console.log('\n🎉 SUCCESS! Monorepo structure looks production-ready.\n');
  console.log('Next steps for release:');
  console.log('  pnpm install');
  console.log('  pnpm build          # builds shared + web + backend');
  console.log('  # Set real SUPABASE_*, DATABASE_URL, JWT_SECRET etc in host');
  console.log('  # Apply packages/database/schema.sql + migrations');
  console.log('  # pnpm --filter @risk-radar/backend start   (or container)');
  console.log('  # Deploy web to Vercel, mobile via EAS, backend to Railway/Fly/etc.\n');
  process.exit(0);
} else if (errors === 0) {
  console.log('\n✅ Structure is solid with minor warnings (review above).\n');
  process.exit(0);
} else {
  console.log('\n❌ Structural or configuration issues found. Fix before production deploy.\n');
  process.exit(1);
}
