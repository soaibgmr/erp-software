# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ERP Software: POS billing, customers' dues, inventory and GST reports for multi-branch automobile parts shops in India. Workshop/job cards and purchasing (suppliers, purchase orders, goods receipts, supplier bills, payables) were deliberately removed; don't add them back without asking. An npm-workspaces monorepo:

| Folder | What |
|---|---|
| `api/` | Express 5 + Prisma 7 + PostgreSQL REST API. **Read `api/CLAUDE.md` before touching the API**: it documents the module layout, DI rules, request pipeline, stock ledger and POS/invoice flows in detail. |
| `ui/` | React 19 + Vite + Tailwind 4 SPA (TanStack Query, React Hook Form, react-router). |
| `packages/shared/` | `@erp-software/shared`: zod schemas, permission catalog, GST/pricing engine, money/quantity helpers, Indian formatting. Used by both api and ui. |
| `docs/` | `PRD.md`, `DEVELOPMENT_PLAN.md`, `DESIGN_PATTERNS.md` (where each pattern applies), `DESIGN_SYSTEM.md` (tokens, components, print layout). Parts of DESIGN_PATTERNS describe planned work (job cards, outbox worker, Zustand); check the code before assuming something exists. |

## Commands

Run from the repo root (Node >= 22.12):

```bash
npm install
npm run build:shared      # REQUIRED first: api and ui import @erp-software/shared from its dist/
npm run dev:api           # http://localhost:8000, Swagger at /docs
npm run dev:ui            # http://localhost:5173
npm run typecheck         # builds shared, then tsc in every workspace
npm run lint              # oxlint (config: .oxlintrc.json)
npm test                  # builds shared, then vitest in every workspace (no database needed)
npm run build
npm run format            # prettier
```

Single workspace / single test:

```bash
npm test -w @erp-software/api                                    # or @erp-software/ui, @erp-software/shared
cd api && npx vitest run src/modules/phase3.service.test.ts    # one file
cd api && npx vitest run -t "sells on credit"                  # tests matching a name
```

**Env files (API):** `api/.env.local` = your machine (local PostgreSQL), `api/.env` = live (Supabase, `NODE_ENV=production`). `src/config/load-env.ts` loads `.env.local` first, so it wins locally; real environment variables beat both. To run a command against live from your machine, use `npm run live -w @erp-software/api -- <command>` (e.g. `npm run db:deploy:live -w @erp-software/api`), which sets `APP_ENV=live` and skips `.env.local`.

**Supabase (live):** only used as a hosted PostgreSQL. Tables are changed **only** through Prisma migrations (`npm run db:deploy:live -w @erp-software/api`), never the Supabase dashboard, Supabase CLI migrations or MCP `apply_migration`, so live always matches `api/src/prisma/migrations`. The app does its own auth (JWT) and permission checks in the API; it does not use Supabase Auth, RLS, Storage or Edge Functions. The installed `.claude/skills/supabase*` skills are general Supabase guidance; this rule wins where they differ.

Database (API workspace): `npm run db:migrate -w @erp-software/api`, `db:generate`, `db:seed`, `db:deploy`, `db:studio`. First run: copy `api/.env.example` → `api/.env` and `ui/.env.example` → `ui/.env`. `VITE_CLIENT_ID` must equal the API's `CLIENT_ID`, because every `/api/v1` request carries a `clientid` header.

**Deploy (Vercel, from GitHub `main`):** two Vercel projects on one repo, `erp-software-api` (Root Directory `api`) and `erp-software-ui` (Root Directory `ui`), both with "Include source files outside of the Root Directory" on. Settings live in `api/vercel.json` and `ui/vercel.json` (install and build run from the repo root, shared is built first). The API runs as one function, `api/api/index.js`, which loads the tsc-built `api/dist/app.js` (Vercel does not compile our TypeScript); `src/server.ts` is only for local/long-running hosts. Env vars are set in the Vercel dashboard, not files: API uses the Supabase transaction pooler (port 6543) with `DB_POOL_MAX=2` and `CORS_ORIGIN` = the UI URL; UI needs `VITE_API_URL` and `VITE_CLIENT_ID` (inlined at build time, so redeploy after changing them). Run `npm run db:deploy:live -w @erp-software/api` **before** pushing code that needs a new migration; Vercel never runs migrations.

CI (`.github/workflows/ci.yml`) runs `npm ci`, `typecheck`, `lint`, `test`, `build`, in that order.

**After editing `packages/shared/src`, rebuild it** (`npm run build:shared`). The api and ui resolve the package's `dist/`, so they keep seeing the old code until it is rebuilt. `dist/` folders in every workspace are build output; never edit them.

## Cross-workspace architecture

- **One source of truth in shared.** The same zod schemas validate API requests (`validate()` middleware) and UI forms (`zodResolver`). `priceCart` (`pricing.ts`) prices the POS cart in the browser and the invoice on the server, so the totals always match. Permissions (`permissions.ts`), status enums and their labels (`INVOICE_STATUS_LABELS`, `PAYMENT_METHOD_LABELS`, …), document number series (`documents.ts`) and report definitions (`REPORTS`) all live there. Change them in shared and both sides follow.
- **Money and quantities.** Calculations use integer paise (`money.ts`) and integer thousandths for quantity (`quantity.ts`). The API sends money as 2-decimal strings and quantity as 3-decimal strings. Format only for display, with `formatINR`.
- **API contract.** Every response is an envelope: `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`. `ui/src/lib/api-client.ts` unwraps it, adds the `clientid`, Bearer token and `x-branch-id` headers, turns errors into `ApiError` (whose `fieldErrors` map server field errors onto forms), and rotates the refresh token once on a 401. UI DTO types are hand-written in `ui/src/lib/types.ts`; update them when an API DTO changes.
- **Branch scope.** Most data belongs to a branch. The UI sends the selected branch as `x-branch-id` (from `useAuth().branch`). Branch-scoped query keys include the branch id.
- **Time zone.** Day boundaries, financial year (April–March), due dates and report periods use `APP_TIMEZONE` (default `Asia/Kolkata`; helpers in `api/src/utils/time.ts`). The UI reads it from `GET /api/v1/health`.

## UI structure (`ui/src`)

- `app/`: router (print routes render outside the app shell), `AppShell`, `auth.tsx` (`useAuth`, `can(permission)` for permission-aware UI), `hotkeys.ts` (`useHotkey`), command palette, nav.
- `features/<module>/`: each feature owns its `api.ts` (TanStack Query hooks plus query-key factories such as `salesKeys`; mutations invalidate the related keys), its pages and its components. `features/pos` is the billing screen (cart in `cart.ts`, payment dialog in `Dialogs.tsx`, keyboard shortcuts in `shortcuts.ts`). `features/print` holds the A4/A5/thermal print views. `features/dev` is the component gallery at `/dev/components`.
- `components/ui/`: design-system primitives (`Button`, `Field`, `Modal`, `DataTable`, `States`, `Toast`, …). Use the tokens from `DESIGN_SYSTEM.md` and `styles/`, not hex values. Yellow (`accent`) is reserved for the one money action on a screen.
- Import alias: `@/` → `ui/src`.

## UI wording

Users are shop owners and counter staff, not accountants. Prefer plain business words in labels and messages:
- An unpaid balance is **"Dues"** or **"Pay later"**, not "credit". The customer limits are **"Maximum dues allowed"**, **"Days to clear dues"** and **"Can still owe"**. The code and API still use `credit*` names (`CREDIT` payment mode, `creditLimit`, `credit.override`); only the visible text changed.
- Cash handed over is **"Cash received"**, not "tendered".
- **"Credit note"** stays as is: it is the GST document name.
