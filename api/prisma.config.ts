import "./src/config/load-env";
import { defineConfig } from "prisma/config";

// CLI-only config (migrate, studio, seed). Uses the direct, non-pooled
// connection because migrations need session-level features that poolers
// like PgBouncer (transaction mode) don't support.
// process.env (not env()) so `prisma generate` works in build stages without DB vars.
export default defineConfig({
  schema: "src/prisma/schema",
  migrations: {
    path: "src/prisma/migrations",
    seed: "tsx src/prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
