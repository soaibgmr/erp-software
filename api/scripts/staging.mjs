// Runs a command against the STAGING (Supabase) database: loads only .env.staging.
//   node scripts/staging.mjs prisma migrate deploy
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/staging.mjs <command> [args…]");
  process.exit(1);
}
if (!existsSync(new URL("../.env.staging", import.meta.url))) {
  console.error("[staging] api/.env.staging is missing (copy api/.env and point it at the staging Supabase project).");
  process.exit(1);
}
console.log(`[staging] ${cmd} ${args.join(" ")}  (using .env.staging)`);
const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, APP_ENV: "staging" } });
process.exit(r.status ?? 1);
