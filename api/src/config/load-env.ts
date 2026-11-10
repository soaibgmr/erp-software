// Loads environment files before anything reads process.env.
//
//   .env.local  your machine only (local PostgreSQL). Never deployed; git-ignored.
//   .env        live settings (Supabase). Used on the server, where there is no .env.local.
//
// Order of precedence: real environment variables (set by the host) > .env.local > .env.
// dotenv never overwrites a variable that is already set, so the first file loaded wins.
// APP_ENV=live (see scripts/live.mjs) skips .env.local to run a command against the live database.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// api/ (src/config or dist/config → ../..); falls back to the working directory if __dirname is unavailable.
const root = typeof __dirname === "string" ? resolve(__dirname, "../..") : process.cwd();
const useLocal = process.env.APP_ENV !== "live" && process.env.NODE_ENV !== "production";
for (const file of [...(useLocal ? [".env.local"] : []), ".env"]) {
  const path = resolve(root, file);
  if (existsSync(path)) config({ path, quiet: true });
}
