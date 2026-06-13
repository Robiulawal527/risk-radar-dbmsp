import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// When running `pnpm dev` (turbo) from the monorepo root, preload root .env* files
// so NEXT_PUBLIC_* values defined at the root level are available even if
// apps/web/.env.local is minimal or absent. Safe: does not override already-set vars.
try {
  const here = dirname(fileURLToPath(import.meta.url)); // apps/web
  const root = resolve(here, '../../');
  const files = [
    '.env',
    '.env.local',
    `.env.${process.env.NODE_ENV || 'development'}`,
    `.env.${process.env.NODE_ENV || 'development'}.local`,
  ];
  for (const f of files) {
    const p = resolve(root, f);
    if (existsSync(p)) dotenvConfig({ path: p, override: false });
  }
} catch {
  // best effort only
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '**.supabase.in', pathname: '/storage/v1/object/public/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
  /** Avoid broken server chunks when `@supabase/supabase-js` is imported from Route Handlers. */
  serverExternalPackages: ['@supabase/supabase-js'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
