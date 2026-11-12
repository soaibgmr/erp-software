// Loads environment files before anything reads process.env.
//
//   .env.local  your machine only (local PostgreSQL). Never deployed; git-ignored.
//   .env        live settings (Supabase). Used on the server, where there is no .env.local.
//   .env.staging staging settings (separate Supabase project). Only loaded with APP_ENV=staging.
//
// Order of precedence: real environment variables (set by the host) > .env.local > .env.
// dotenv never overwrites a variable that is already set, so the first file loaded wins.
// APP_ENV=live (see scripts/live.mjs) skips .env.local to run a command against the live database.
// APP_ENV=staging (see scripts/staging.mjs) loads only .env.staging, to run a command against staging.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// api/ (src/config or dist/config → ../..); falls back to the working directory if __dirname is unavailable.
const root = typeof __dirname === "string" ? resolve(__dirname, "../..") : process.cwd();
const appEnv = process.env.APP_ENV;
const useLocal = appEnv !== "live" && appEnv !== "staging" && process.env.NODE_ENV !== "production";
const files = appEnv === "staging" ? [".env.staging"] : [...(useLocal ? [".env.local"] : []), ".env"];
for (const file of files) {
  const path = resolve(root, file);
  if (existsSync(path)) config({ path, quiet: true });
}
