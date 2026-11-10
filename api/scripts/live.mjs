// Runs a command against the LIVE (Supabase) database by ignoring .env.local.
//   node scripts/live.mjs prisma migrate deploy
import { spawnSync } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/live.mjs <command> [args…]");
  process.exit(1);
}
console.log(`[live] ${cmd} ${args.join(" ")}  (using .env, not .env.local)`);
const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, APP_ENV: "live" } });
process.exit(r.status ?? 1);
