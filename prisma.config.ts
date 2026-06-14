import { config as dotenvConfig } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma integration is UNUSED (see extensive comment in prisma/schema.prisma).
// The real persistence is raw pg + Supabase + packages/database SQL migrations.
// Keeping this file + schema placeholder prevents accidental "missing config" errors if `npx prisma` is invoked.
// To fully excise: delete the prisma/ directory and remove any lingering references.
dotenvConfig({ path: ".env.local" });
dotenvConfig();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
