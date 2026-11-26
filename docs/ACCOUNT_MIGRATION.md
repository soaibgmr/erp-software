# Moving ERP Software to new accounts (GitHub, Vercel, Supabase)

This guide moves the whole project to **new accounts**:

| What | Old | New |
|---|---|---|
| Code | GitHub `soaibgmr/erp-software` | new GitHub account / repo |
| Hosting | Vercel projects `erp-software-api`, `erp-software-ui` | new Vercel team, new project names and URLs |
| Database | Supabase live + staging projects | new Supabase org, new live + staging projects (live data copied) |

Do the steps **in order**. The old setup keeps running untouched until step 11, so if anything goes wrong you can simply keep using the old URLs (see step 12).

---

## Checklist

| # | Step | Done |
|---|---|---|
| 0 | Before you start: accounts, tools, copy old settings | ☐ |
| 1 | Create the new Supabase projects | ☐ |
| 2 | Prepare the new staging database | ☐ |
| 3 | Copy live data into the new live database (rehearsal) | ☐ |
| 4 | Create the new GitHub repo and push the code | ☐ |
| 5 | Create the new Vercel projects | ☐ |
| 6 | Add the Vercel environment variables | ☐ |
| 7 | Add the GitHub environments and secrets | ☐ |
| 8 | Change the code (staging URLs) and local files | ☐ |
| 9 | Deploy and test staging | ☐ |
| 10 | Final live data copy and go live | ☐ |
| 11 | Tell the shops, then clean up the old accounts | ☐ |
| 12 | (Only if needed) Roll back | ☐ |

## Worksheet: values to collect

Fill this in as you go (keep it private, it holds passwords; don't commit it).

| Value | Where you get it | Your value |
|---|---|---|
| New GitHub repo URL | Step 4 | |
| New live DB `DATABASE_URL` (pooler, port 6543) | Step 1 | |
| New live DB `DIRECT_URL` (session pooler, port 5432) | Step 1 | |
| New staging DB `DATABASE_URL` (port 6543) | Step 1 | |
| New staging DB `DIRECT_URL` (port 5432) | Step 1 | |
| Vercel Team ID (`VERCEL_ORG_ID`) | Step 5 | |
| Vercel API Project ID (`VERCEL_PROJECT_ID_API`) | Step 5 | |
| Vercel UI Project ID (`VERCEL_PROJECT_ID_UI`) | Step 5 | |
| Vercel token (`VERCEL_TOKEN`) | Step 5 | |
| New production API URL | Step 5 | `https://<new-api>.vercel.app` |
| New production UI URL | Step 5 | `https://<new-ui>.vercel.app` |
| New staging API URL (alias) | Step 5 | `https://<new-api>-staging.vercel.app` |
| New staging UI URL (alias) | Step 5 | `https://<new-ui>-staging.vercel.app` |

---

## Step 0. Before you start

1. **Create the new accounts** (or get invited to them): GitHub, Vercel, Supabase.
2. **Vercel plan:** the Hobby (free) plan is for non-commercial use only and has lower limits. This app sells to shops and its API uses `maxDuration: 300` and region `bom1` (`api/vercel.json`), so use **Vercel Pro** for the new team.
3. **Tools on your PC:**
   - git, Node.js 22.12 or newer (`node -v`)
   - Vercel CLI: `npm i -g vercel`
   - PostgreSQL **17** client tools (`pg_dump`, `pg_restore`, `psql`). On Windows, install PostgreSQL 17 from postgresql.org and tick only "Command Line Tools". The client version must be the same as or newer than the Supabase server version.
4. **Copy the old settings** (you need the values in step 6):
   - Old Vercel → project `erp-software-api` → Settings → Environment Variables: note every variable for **Production** and for **Preview**. Same for `erp-software-ui`.
   - Or with the CLI, inside `api/` and `ui/` (still linked to the old projects):
     ```bash
     vercel env pull ../old-api-production.env --environment=production
     vercel env pull ../old-api-preview.env --environment=preview
     ```
     Delete these files when you are done; they contain secrets.
   - Old GitHub repo → Settings → Environments → `production` and `staging`: note the secret **names** (values can't be read; you'll create new ones anyway).

✅ Check: you have the new accounts, the tools work, and you have a list of every old env var.

---

## Step 1. Create the new Supabase projects

1. In the new Supabase account create an **organization**, then **two projects**:
   - `erp-software-live`, region **South Asia (Mumbai) `ap-south-1`**
   - `erp-software-staging`, region **Mumbai `ap-south-1`**

   Keep the API (Vercel `bom1`) and the databases in the same region, or every query gets slow.
2. Save each project's **database password** in your password manager.
3. For each project open **Connect** (top bar) and copy:
   - **Transaction pooler** (port **6543**) → this is `DATABASE_URL` (used by the app on Vercel).
   - **Session pooler** (port **5432**) → this is `DIRECT_URL` (used for migrations and the data copy). The "Direct connection" host is IPv6-only, which most Windows PCs and GitHub runners can't reach, so use the session pooler.
4. Write the four URLs into the worksheet. Use the same extra parameters your old URLs had (for example `?sslmode=require`, `&pgbouncer=true`), only the host, user and password change.
5. **Don't** create tables in the Supabase dashboard. Tables are created only by Prisma migrations (step 2) or by the data copy (step 3).

✅ Check: two projects exist in Mumbai, and you have four connection URLs.

---

## Step 2. Prepare the new staging database

Staging starts empty (no need to copy old staging data).

1. Open `api/.env.staging` on your PC and replace `DATABASE_URL` and `DIRECT_URL` with the **new staging** URLs.
2. Create the tables and the platform admin:
   ```bash
   npm install
   npm run build:shared
   npm run db:deploy:staging -w @erp-software/api
   npm run db:seed:staging -w @erp-software/api
   ```
   The seed reads `SEED_PLATFORM_ADMIN_EMAIL` / `SEED_PLATFORM_ADMIN_PASSWORD` (at least 12 characters) from `api/.env.staging`.

✅ Check: `npm run staging -w @erp-software/api -- npx prisma migrate status` says **"Database schema is up to date"**.

---

## Step 3. Copy live data into the new live database (rehearsal)

Do this once now as a **rehearsal** (to make sure it works), and again in step 10 for the real move. Run the commands in **Git Bash** from any folder outside the repo. Put the URLs in variables first (use the **port 5432 session pooler** URLs):

```bash
OLD_LIVE='postgresql://postgres.<old-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
NEW_LIVE='postgresql://postgres.<new-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
```

1. **Check where the `pg_trgm` extension lives** in the old database (item search needs it):
   ```bash
   psql "$OLD_LIVE" -c "select extname, extnamespace::regnamespace from pg_extension where extname = 'pg_trgm';"
   ```
   Create it in the **same schema** on the new database (usually `public` or `extensions`):
   ```bash
   psql "$NEW_LIVE" -c "create extension if not exists pg_trgm schema public;"   # or: schema extensions
   ```
2. **Dump** the old live data (tables, data, indexes and the `_prisma_migrations` history, all in the `public` schema):
   ```bash
   pg_dump "$OLD_LIVE" --schema=public --no-owner --no-privileges --format=custom --file=live.dump
   ```
3. **Restore** into the new live database. On the **rehearsal**, if you run it a second time, first reset the new database's `public` schema (Supabase → new live project → SQL editor: `drop schema public cascade; create schema public; grant all on schema public to postgres, anon, authenticated, service_role;`, then redo 3.1). Never run that on the old database.
   ```bash
   pg_restore --no-owner --no-privileges --dbname="$NEW_LIVE" live.dump
   ```
   A few warnings about `schema "public" already exists` are fine. Real errors (a failed `CREATE INDEX` or a missing table) are not: fix and redo.
4. **Compare row counts** on old and new (both must match):
   ```bash
   for DB in "$OLD_LIVE" "$NEW_LIVE"; do
     psql "$DB" -At -c "select 'businesses', count(*) from businesses union all
       select 'users', count(*) from users union all
       select 'customers', count(*) from customers union all
       select 'items', count(*) from items union all
       select 'invoices', count(*) from invoices union all
       select 'payments', count(*) from payments union all
       select 'stock_ledger', count(*) from stock_ledger;"
     echo ----
   done
   ```
5. **Check the migration history** from the repo: temporarily put the **new live** URLs into `api/.env`, then:
   ```bash
   npm run live -w @erp-software/api -- npx prisma migrate status
   ```
   It must say **"Database schema is up to date"**.
6. Delete `live.dump` when you're done (it holds customer data).

✅ Check: counts match and Prisma says the schema is up to date.

---

## Step 4. Create the new GitHub repo and push the code

1. In the new GitHub account create an **empty private** repository (no README, no .gitignore, no license), for example `erp-software`.
2. Copy the full history, every branch (`main`, `dev`, …) and every tag:
   ```bash
   git clone --mirror https://github.com/soaibgmr/erp-software.git erp-mirror.git
   cd erp-mirror.git
   git push --mirror https://github.com/<new-account>/erp-software.git
   cd .. && rm -rf erp-mirror.git
   ```
   *(Alternative: old repo → Settings → Transfer ownership. That moves issues/PRs too, but the old repo disappears from the old account at once.)*
3. Point your local copy at the new repo:
   ```bash
   cd C:/xampp/htdocs/erp-software
   git remote set-url origin https://github.com/<new-account>/erp-software.git
   git fetch origin
   git remote -v
   ```
4. New repo → **Actions** tab: make sure Actions are enabled. The first runs will fail until steps 5 to 7 are done; that's expected.
5. Optional: protect `main` (Settings → Branches → require the CI check before merging).

✅ Check: the new repo shows `main` and `dev` with the full commit history, and `git remote -v` shows the new URL.

---

## Step 5. Create the new Vercel projects

1. In the new Vercel account create a **team** (Pro plan, see step 0).
2. **Add New → Project → Import** the new GitHub repo. Create the **API** project:
   - Project name: e.g. `<brand>-erp-api` (the old name `erp-software-api` is still taken by the old account)
   - **Root Directory:** `api`
   - Framework Preset: **Other**
   - Build/Install commands: leave them; `api/vercel.json` sets them.
   - Deploy. The first build may fail because env vars are missing; that's fine.
3. Import the same repo again for the **UI** project:
   - Project name: e.g. `<brand>-erp-ui`
   - **Root Directory:** `ui`
   - Framework Preset: **Vite**
4. In **both** projects:
   - Settings → Build and Deployment → Root Directory → **"Include files outside of the Root Directory in the Build Step": ON**
   - Settings → Build and Deployment → **Node.js Version: 22.x** (or 24.x)
   - Settings → **Deployment Protection → Vercel Authentication: OFF** (otherwise the staging UI can't call the staging API)
   - Settings → Functions (API project): region is taken from `api/vercel.json` (`bom1`), nothing to change.
5. Collect the IDs into the worksheet:
   - **Team ID:** Team → Settings → General → "Team ID" → `VERCEL_ORG_ID`
   - **Project ID:** each project → Settings → General → "Project ID" → `VERCEL_PROJECT_ID_API` / `VERCEL_PROJECT_ID_UI`
   - **Token:** Account Settings → Tokens → Create, **scope = the new team**, no expiry or a long one → `VERCEL_TOKEN`
6. Decide the URLs:
   - Production: `https://<brand>-erp-api.vercel.app` and `https://<brand>-erp-ui.vercel.app` (shown on each project's page)
   - Staging aliases (used by CI in step 8): `<brand>-erp-api-staging.vercel.app` and `<brand>-erp-ui-staging.vercel.app`. They must be free names; CI claims them on the first staging deploy.

Vercel's own Git deploys stay off (`"git": { "deploymentEnabled": false }` in both `vercel.json`): every real deployment comes from GitHub Actions, which migrates the database first.

✅ Check: two projects exist with the right Root Directory, and you have the team ID, two project IDs, a token and the four URLs.

---

## Step 6. Add the Vercel environment variables

Add these in each project → Settings → Environment Variables. **Production** = live settings, **Preview** = staging settings. Copy the values from the old projects (step 0) and change only the ones marked **NEW**.

### API project

| Variable | Production (live) | Preview (staging) |
|---|---|---|
| `NODE_ENV` | `production` | `production` |
| `DATABASE_URL` | **NEW** live transaction pooler (6543) | **NEW** staging transaction pooler (6543) |
| `DIRECT_URL` | optional (only migrations need it; CI has its own) | optional |
| `DB_POOL_MAX` | `2` | `2` |
| `JWT_SECRET` | same as old live (or a new one, at least 32 chars; a new one only signs everybody out) | same as old staging |
| `CLIENT_ID` | same as old live | same as old staging |
| `CORS_ORIGIN` | **NEW** production UI URL | **NEW** staging UI URL |
| `APP_URL` | **NEW** production UI URL | **NEW** staging UI URL |
| `APP_TIMEZONE` | `Asia/Kolkata` | `Asia/Kolkata` |
| `APP_NAME` | as old | as old |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | as old | as old |
| `MAIL_FROM`, `PLATFORM_ADMIN_NOTIFY_EMAIL` | as old | as old |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | as old (optional) | as old (optional) |
| `LOG_LEVEL` | `info` | `info` |
| `SWAGGER_ENABLED` | as old | as old |

Plus any other variable you found on the old project in step 0.

### UI project

These are put into the code at **build time**: after changing one, redeploy.

| Variable | Production | Preview |
|---|---|---|
| `VITE_API_URL` | **NEW** `https://<brand>-erp-api.vercel.app/api/v1` | **NEW** `https://<brand>-erp-api-staging.vercel.app/api/v1` |
| `VITE_CLIENT_ID` | = API `CLIENT_ID` (production) | = API `CLIENT_ID` (preview) |
| `VITE_SENTRY_DSN` | as old (optional) | as old (optional) |
| `VITE_APP_NAME` | as old | as old |
| `VITE_CONTACT_EMAIL` | as old | as old |

✅ Check: both projects have every variable in both Production and Preview, and `VITE_CLIENT_ID` equals `CLIENT_ID` for each environment.

---

## Step 7. Add the GitHub environments and secrets

New repo → **Settings → Environments → New environment**:

1. **`production`**
   - Deployment branches: **Selected branches → `main`**
   - Secrets:
     | Secret | Value |
     |---|---|
     | `DIRECT_URL` | **new live** session pooler URL (5432) |
     | `VERCEL_TOKEN` | the token from step 5 |
     | `VERCEL_ORG_ID` | the team ID |
     | `VERCEL_PROJECT_ID_API` | the API project ID |
     | `VERCEL_PROJECT_ID_UI` | the UI project ID |
2. **`staging`**
   - Deployment branches: **Selected branches → `dev`**
   - Same five secrets, but `DIRECT_URL` = **new staging** session pooler URL. The Vercel token and IDs are the same values as production.

The names must be exactly these: `.github/workflows/ci.yml` reads them. Keeping the live `DIRECT_URL` only in `production` means the `dev` branch can never migrate the live database.

✅ Check: two environments, five secrets each, branch rules set.

---

## Step 8. Change the code and local files

Work on the `dev` branch.

1. **`.github/workflows/ci.yml`**: change the two staging aliases to your new names:
   ```yaml
   - app: api
     project_secret: VERCEL_PROJECT_ID_API
     staging_alias: <brand>-erp-api-staging.vercel.app
   - app: ui
     project_secret: VERCEL_PROJECT_ID_UI
     staging_alias: <brand>-erp-ui-staging.vercel.app
   ```
   and update the two URLs in the comment at the top of the file.
2. **`CLAUDE.md`**: replace the old staging URLs, the Vercel project names and the GitHub repo mention with the new ones.
3. **`ui/vercel.json`**: nothing to change while the API stays on `*.vercel.app`. If you ever put the API on your own domain, add it to `connect-src` in the Content-Security-Policy.
4. **Re-link the Vercel CLI on your PC** (the `.vercel` folders still point to the old projects):
   ```bash
   rm -rf api/.vercel ui/.vercel
   vercel login                      # log in to the NEW account
   cd api && vercel link             # choose the new team and the new API project
   cd ../ui && vercel link           # choose the new team and the new UI project
   ```
5. **Local env files** (git-ignored, not committed):
   - `api/.env` (used by `npm run live …`): new **live** `DATABASE_URL` and `DIRECT_URL`
   - `api/.env.staging`: new **staging** URLs (already done in step 2)
   - `api/.env.local` (your local PostgreSQL): no change
6. Check and commit:
   ```bash
   npm run typecheck && npm run lint && npm test
   git add .github/workflows/ci.yml CLAUDE.md
   git commit -m "Move to new GitHub, Vercel and Supabase accounts"
   ```
   Don't push yet; step 9 does.

✅ Check: `git diff HEAD~1` shows only the URL/name changes, and the checks pass.

---

## Step 9. Deploy and test staging

1. Push: `git push origin dev`
2. New repo → **Actions** → watch the "CI/CD" run: `check` → `migrate` (new staging DB) → `deploy (api)` → `deploy (ui)`. All four must be green.
3. Test:
   - `https://<brand>-erp-api-staging.vercel.app/api/v1/health` → `success: true` and `timezone: "Asia/Kolkata"`
   - `https://<brand>-erp-api-staging.vercel.app/api/v1/health/db` → database OK
   - Open `https://<brand>-erp-ui-staging.vercel.app`, sign in as the platform admin (from the step 2 seed), go to `/admin`.
   - Register a test shop on staging, approve it in `/admin`, sign in as its owner, add an item and a customer, open a shift and make a test bill. Check the bill email arrives (or appears in the Vercel logs if SMTP is off).
4. If a step fails: open the failed job's log. Usual causes: a missing secret (step 7), a missing env var (step 6), "Include files outside of the Root Directory" off (step 5), or an alias name already taken by someone else (pick another name in step 8).

✅ Check: staging works end to end on the new accounts.

---

## Step 10. Final live data copy and go live

Pick a time when the shops are **closed** (e.g. late night), because bills made on the old site after the copy would not reach the new database.

1. Tell the shops the time of the move. From now until the end of this step nobody should use the old site.
2. Redo **step 3** for real (reset the new live `public` schema first, since the rehearsal already filled it, then pg_trgm, dump, restore, compare counts, migrate status).
3. Ship the code to production:
   ```bash
   git checkout main
   git pull
   git merge dev
   git push origin main
   ```
4. Watch the Actions run: `check` → `migrate` (new **live** DB; nothing to do if step 3 copied the latest schema) → `deploy (api)` → `deploy (ui)`, all green.
5. Test production the same way as step 9 (health, health/db, platform admin `/admin`), then sign in as a **real shop owner** and check: their items, customers, dues and old invoices are there; reports for this month show the same totals as the old site; make one small real or test bill.

✅ Check: production on the new accounts shows all the old data and billing works.

---

## Step 11. Tell the shops, then clean up the old accounts

1. **Tell every shop the new web address** (`https://<brand>-erp-ui.vercel.app`). Everyone must **sign in again** once: logins are saved per website address. Passwords don't change.
2. **Optional: send the old address to the new one.** In the old UI project, deploy a tiny project whose `vercel.json` is only:
   ```json
   { "redirects": [{ "source": "/(.*)", "destination": "https://<brand>-erp-ui.vercel.app/$1", "permanent": false }] }
   ```
3. Wait **1–2 weeks** with the old setup still in place (switched off for users). Then:
   - Take a final backup of the old live database (`pg_dump … --format=custom --file=old-live-final.dump`) and keep it somewhere safe.
   - Old Vercel: delete `erp-software-api` and `erp-software-ui` (or keep only the redirect project), and delete old tokens (Account Settings → Tokens).
   - Old Supabase: pause, later delete, the old live and staging projects.
   - Old GitHub repo: Settings → **Archive this repository** (read-only), and remove its environment secrets.
   - Change any password or key that was shared with the old accounts (SMTP password, Sentry DSN if you want).

✅ Check: shops use only the new address, and nothing of value is left only in the old accounts.

---

## Step 12. Roll back (only if needed)

Until step 11 the old GitHub repo, Vercel projects and Supabase databases are unchanged, so:

1. Tell the shops to go back to the old address.
2. Bills made on the new site after step 10 exist **only in the new database**. Note them (invoice numbers from the new site's Sales list) and enter them again on the old site, or copy them across before retrying the move.
3. Fix the problem, then repeat from step 10.

---

## Quick reference: where each setting lives

| Setting | Where |
|---|---|
| Build / install commands, region `bom1`, `maxDuration` | `api/vercel.json`, `ui/vercel.json` (in the repo, move automatically) |
| Security headers / CSP | `ui/vercel.json` |
| Staging alias names | `.github/workflows/ci.yml` (`staging_alias`) |
| App env vars | Vercel → each project → Environment Variables (Production / Preview) |
| CI secrets | GitHub → Settings → Environments → `production` / `staging` |
| Local env | `api/.env` (live), `api/.env.staging`, `api/.env.local`, `ui/.env` (never committed) |
| Database tables | Prisma migrations in `api/src/prisma/migrations` only (never the Supabase dashboard) |
