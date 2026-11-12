# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The REST API of ERP Software (Express 5, PostgreSQL via Prisma 7). It lives in an npm-workspaces monorepo next to `ui/` (React) and `packages/shared/` (zod schemas, permission catalog, GST/money helpers used by both). Product docs are in `../docs/` (PRD, development plan, design patterns, design system).

Multi-company: see "Multi-company" in the root `CLAUDE.md`. Added for it: `platform` (platform admin, shop approval), `mail` (shared email service), sign-up and password reset in `users` (`account.service.ts`) and `business/provision.ts`.

Phase 1 modules: `users` (auth), `roles`, `branches`, `business`, `settings`, `document-sequences`, `customers`, `audit`, plus `health`.
Phase 3 modules: `shifts`, `pos` (quote, held carts), `invoices` (charge, list/detail/print, cancel, payments, credit notes).
Purchasing (Phase 5: `suppliers`, `purchases`, `order-list`) was **removed on 2026-11-10** at the owner's request: no suppliers, purchase orders, goods receipts, supplier bills/payments, debit notes, order list or payables. Stock comes in only through adjustments (e.g. `OPENING_STOCK`), transfers and the CSV import; `items.purchasePrice` is maintained by hand. Old `PURCHASE` / `PURCHASE_RETURN` stock ledger rows stay as history. Don't reintroduce purchase code without asking.
Phase 6 modules: `dashboard` (KPIs, sales trend, low stock) and `reports` (all reports, GSTR-1 portal JSON, Tally XML).
Phase 2 modules: `catalog` (item categories, brands, HSN/SAC, vehicle makes and models: one config-driven module), `items`, `labour-services`, `stock` (levels, ledger, adjustments, transfers, import).

## Commands

```bash
npm run dev          # tsx watch src/server.ts (hot reload)
npm run build        # prisma generate && tsc  -> dist/
npm start            # node dist/server.js
npm run typecheck    # tsc --noEmit

npm run db:migrate   # prisma migrate dev (create/apply migrations locally)
npm run db:deploy    # prisma migrate deploy (production)
npm run db:generate  # regenerate Prisma client after schema edits
npm run db:seed      # idempotent: platform admin (SEED_PLATFORM_ADMIN_*) + optional demo shop (SEED_ADMIN_*)
npm run db:studio
```

`npm test` runs Vitest (`vitest.config.mts` supplies a test env; tests use in-memory fakes from `src/test/fakes.ts` and Supertest against routes that answer before any query, so no database is needed). Lint with `npm run lint` (oxlint) from the repo root. `@erp-software/shared` must be built (`npm run build:shared` at the root) before the API typechecks or runs; it builds an ESM `dist/index.js` (used by the UI) plus a CommonJS bundle `dist/index.cjs` (picked by the API's `require` through the `exports` map, because Vercel's Node runtime does not support `require(esm)`). `npm run dev -w @erp-software/shared` only rebuilds the ESM output, so run `npm run build:shared` after editing shared.

In Prisma 7, `db:migrate` does **not** regenerate the client after a schema change. Run `npm run db:generate` afterwards. VS Code keeps the old types until its TS server restarts, so editor errors can be stale while `tsc` passes.

Env files: `.env.local` (local PostgreSQL) overrides `.env` (live Supabase); both git-ignored, loaded by `src/config/load-env.ts` (imported by `env.ts` and `prisma.config.ts`; never import `dotenv/config` directly). `npm run live -- <cmd>` / `npm run db:deploy:live` run against live by setting `APP_ENV=live`, which skips `.env.local`. Copy `.env.example` to both before running. `src/config/env.ts` validates the env with zod at import time. The process exits if a required var (`DATABASE_URL`, `JWT_SECRET`) is missing or invalid. `DIRECT_URL` is optional to the app (only the Prisma CLI needs it), so serverless hosts can leave it unset. So any new env var must be added to that schema (and to `.env.example`). Read config through the exported `env`, not `process.env`. Notable optional vars:
- `CLIENT_ID` (see below).
- `SWAGGER_ENABLED`: on by default outside production.
- `APP_TIMEZONE`: an IANA name, default `Asia/Kolkata`, validated at startup.

Migrations: `init` (users + refresh_tokens), then `phase1_masters_rbac`, which replaces `users.role` with `users.role_id` (existing ADMINs become OWNER, others COUNTER), then `phase2_inventory` (enables `pg_trgm`, adds the catalog/item/stock tables and two document types, grants `stock.approve` to Branch manager), then `phase3_pos_invoices`, `remove_job_cards`, the `phase5_*` purchasing migrations, `customer_opening_balance`, `remove_purchasing` (drops every purchasing table, the PO/GRN/DN number series and the `purchase.*` / `supplier.*` permissions) and `multi_company` (adds `business_id` everywhere and backfills it with the one existing business, which becomes ACTIVE; adds `users.mobile`, `auth_tokens` and `platform_admins`; makes branch code, role key/name and settings unique per business), then `rate_limits` (shared counters behind `IAttemptLimiter` in `src/common/attempt-limiter.ts`: per-IP limits in `middleware/rate-limit.ts` and the lockout after 8 wrong passwords in 15 minutes for login, platform login and the POS manager override; times are always sent from the app, never the database's `now()`, because Prisma writes dates as wall-clock text), then `demo_requests` ("Book a quick demo" from the landing page, in the `platform` module), then `pos_scan_sessions` (phone scanner sessions and their scans). Trigram GIN indexes are declared in `inventory.prisma` with `ops: raw("gin_trgm_ops")`; the extension itself is created in the migration SQL. `npm run db:seed` is idempotent: the platform admin, plus a demo ACTIVE shop (business, roles, MAIN branch, owner) unless its owner email already exists.

## Architecture

- **Entry flow:** `src/server.ts` connects to the DB and fails fast if `SELECT 1` fails. It then starts the HTTP server and handles graceful shutdown on SIGINT/SIGTERM, with a 10s forced-exit timeout. `src/app.ts` builds the Express app without calling `listen`: `express.json()`, the routers from `src/modules/index.routes.ts`, then the 404 and error handlers.
- **Database client:** `src/config/database.ts` exports one `prisma` instance using the `@prisma/adapter-pg` driver adapter. Pool settings come from the `DB_*` env vars. Outside production the client is cached on `globalThis`, so `tsx watch` reloads don't leak connections. It is also bound in the DI container as `TYPES.PrismaClient`, and repositories receive it with `@inject(TYPES.PrismaClient)` instead of importing it. Never construct a new `PrismaClient`.
- **Two connection URLs:**
  - `DATABASE_URL` is used at runtime and may point at a pooler like PgBouncer.
  - `DIRECT_URL` is used only by the Prisma CLI, via `prisma.config.ts`, because migrations need a non-pooled connection.
  - Neither URL appears in `schema.prisma`; that is intentional.
- **Prisma layout:** the schema is split across files in `src/prisma/schema/`. `schema.prisma` holds the generator and datasource, and each domain gets its own `.prisma` file (`organization`, `users`, `customers`, `inventory`, `sales`). Migrations live in `src/prisma/migrations/`. The client is generated into `node_modules` and imported from `@prisma/client`.
- **DB conventions** (follow these for new models):
  - camelCase fields mapped to snake_case columns with `@map`.
  - Tables mapped to plural snake_case with `@@map`; enums mapped with `@@map` too.
  - UUID primary keys (`@db.Uuid`), `Timestamptz(3)` timestamps and explicit `VarChar` lengths.
  - Records are **soft-deleted** via `deletedAt`. Don't hard-delete, and filter out `deletedAt != null` in queries.
- **Soft delete vs unique indexes:** unique indexes (e.g. `users.email`) also cover soft-deleted rows. Uniqueness pre-checks must therefore ignore `deletedAt`. If one doesn't, the insert hits P2002, which still reaches the client as a 409 through the error handler.
- **Prisma type gap:** `tsc` does not reliably reject unknown fields inside the `where` of generic calls like `findFirst`. Before filtering on a column (e.g. `deletedAt`), check that the model actually has it.
- **Feature modules:** code is organized by domain under `src/modules/<domain>/`, with a layered set of files:
  - `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts`. The repository is the only layer that touches Prisma.
  - `*.schema.ts` (zod), `*.types.ts` (DTOs: `CreateXDto`, `UpdateXDto`, `XResponseDto`, `ListXQuery`) and `*.docs.ts` (OpenAPI).
  - `interfaces/i<domain>.service.ts` and `interfaces/i<domain>.repository.ts`.

  `src/modules/users/` is the reference implementation. It also owns auth: `user.routes.ts` exports both `authRouter` (register/login/refresh/logout/forgot-password/reset-password/verify-email) and `usersRouter`, and there is no separate auth module. Services may inject other modules' repository interfaces.
- **Registering a module** touches four places:
  - `TYPES` in `src/config/ioc.types.ts`.
  - The bindings in `src/config/inversify.config.ts`.
  - The router in `src/modules/index.routes.ts`.
  - Paths, schemas and a tag in `src/docs/openapi.ts`.
- **Dependency injection (Inversify):**
  - Services and repositories implement an `I*` interface and are bound as `bind<IFoo>(TYPES.Foo).to(Foo).inSingletonScope()`. Consumers depend on the interface, never the concrete class.
  - Controllers and `AuthMiddleware` have no interface and are bound to their concrete class.
  - Every class is `@injectable()`, and **every constructor parameter needs an explicit `@inject(TYPES.X)`**. `tsx` (esbuild) doesn't emit decorator metadata, so type-based autowiring works after `tsc` but breaks in `npm run dev`.
  - `reflect-metadata` is imported first in `src/server.ts`.
- **Routing:** plain Express routers. A `*.routes.ts` file calls `container.get(TYPES.XController)` and maps paths to controller methods, which are arrow-function properties (no `.bind`). `src/modules/index.routes.ts` lists every router:
  - `publicRoutes` is mounted at `/` and needs no header. It serves `/` and, when enabled, Swagger UI at `/docs`.
  - `apiRoutes` is mounted at `/api/v1`. Register new module routers here; don't touch `src/app.ts`.
  - Health is served only at `/api/v1/health` and `/api/v1/health/db`, registered before the clientid check. `GET /api/v1/health` also returns `timezone` (`APP_TIMEZONE`). The UI reads the app timezone from there, so it is configured in one place only.
- **Nested routes:** for sub-resources (`/parents/:parentId/children`), create a separate router with `Router({ mergeParams: true })` and mount it in `index.routes.ts` **before** the parent router. Otherwise requests run through the parent router's middleware first.
- **Client ID:** `verifyClientId` (`src/middleware/client-id.ts`) runs on every `apiRoutes` request. It requires a `clientid` header equal to `CLIENT_ID` and returns 401 otherwise. An empty `CLIENT_ID` skips the check, but env validation requires it when `NODE_ENV=production`.
- `src/middleware/async-handler.ts` exists for parity with other projects. Route handlers don't need it, because Express 5 forwards async rejections itself.
- **Request pipeline:**
  - Every route must run `validate({ body, query, params })` (`src/middleware/validate.ts`). It puts the parsed zod output on `res.locals.body/query/params`, and controllers read from there, not from `req` (Express 5's `req.query` is read-only). A route without `validate()` gets `undefined` inputs.
  - Query booleans use `z.stringbool()`, because `z.coerce.boolean()` turns `"false"` into `true`. Write schemas are `.strict()`.
  - `AuthMiddleware` (`src/middleware/auth.ts`) provides `requireAuth`, `requirePermission(...codes)`, `requireBranch` and `optionalBranch`. `requireAuth` reads a Bearer JWT, re-checks that the user is ACTIVE and not deleted, and sets `res.locals.auth` (`AuthContext` in `src/common/auth-context.ts`).
- **Responses:** every response uses one envelope, defined in `src/common/api-response.ts`:
  - Success: `{ success: true, message?, data, meta? }`. Error: `{ success: false, error: { code, message, details? } }`.
  - Controllers never call `res.json` directly. They use `sendSuccess`, `sendCreated` or `sendPaginated`.
  - Services return a plain `Paginated<T>`, which becomes `data` + `meta: { page, limit, total, totalPages }`.
  - Deletes return 200 with `data: null`, not 204.
- **Errors:** throw the helpers from `src/common/http-error.ts` (`notFound`, `conflict`, `forbidden`, `fieldErrors([{ path, message }])` for service-level field rules shaped like zod errors, …); a plain `Error` becomes a 500. `src/middleware/error-handler.ts` turns them into `{ error: { code, message, details? } }`, and maps Prisma `P2002` to 409 and `P2025` to 404.
- **OpenAPI / Swagger:** `src/docs/openapi.ts` assembles an OpenAPI 3.1 document from each module's `*.docs.ts`. When `SWAGGER_ENABLED` is on, `src/docs/docs.routes.ts` serves Swagger UI at `/docs/` and the spec at `/docs/openapi.json`.
  - Request bodies and query params are generated from the module's zod schemas with `fromZod` / `queryParams` (`src/docs/openapi.helpers.ts`), so they track validation.
  - Response schemas are hand-written next to the paths. Update them when a DTO changes.
  - `operation()` adds the security requirement. Only success responses are documented; there are no shared 400/401/403/404/409 entries.

## Stock and transactions

- **Unit of work:** services that write several tables inject `IUnitOfWork` (`TYPES.UnitOfWork`, `src/common/unit-of-work.ts`) and call `uow.run(async (tx) => …)`; repositories take that `tx` as their `db` argument. Tests pass a fake that just calls the callback.
- **Ledger:** on-hand quantity changes only through `IStockService.post(tx, actor, movements, { allowNegative? })`. It upserts and locks the `branch_stock` rows (`SELECT … FOR UPDATE`, ordered by branch then item), checks availability (on hand − reserved) unless negative stock is allowed (POS setting `allowNegativeStock`, or the caller), inserts `stock_ledger` rows with a running `balanceAfter`, then writes the new balances. `stock_ledger` is append-only; corrections are new movements. Future modules (invoices, GRNs, job cards) describe their stock effect as `StockMovement[]` and call `post` inside their own transaction.
- Quantities are `Decimal(12,3)`, handled as integer thousandths (`toMilli` / `milliToDecimal` in shared) and sent as 3-decimal strings; money is sent as 2-decimal strings.
- **Adjustments** get a number from the `STOCK_ADJUSTMENT` series and post at once, unless their value (|qty| × purchase price) exceeds `inventory.adjustmentApprovalLimit` and the user lacks `stock.approve`; then they stay `PENDING` until approved or rejected. Status changes use a conditional `updateMany` (`where status = PENDING`) so two approvers can't both post.
- **Transfers** (`STOCK_TRANSFER` series): dispatch posts `TRANSFER_OUT` at the sender (never negative) and raises `in_transit` at the receiver; receive (receiver's `x-branch-id` only) posts `TRANSFER_IN`; cancel (sender only) posts `TRANSFER_CANCEL`.
- **Import:** `POST /stock/import` maps CSV headers (aliases like `Part No`, `Price`, `Qty`), validates each row with `itemImportRowSchema`, and reports per row. `commit=true` is refused while any row has errors and runs in one transaction (120 s timeout); `app.ts` raises the JSON body limit to 5 MB for that path only.
- **Update schemas** come from `patchOf(createSchema)` in shared, not `.partial()`: zod 4 keeps `.default()` values under `.partial()`, which would reset defaulted fields on every PATCH.

## POS and invoices

- **Pricing:** `CartPricer` resolves cart lines against items / labour services (master sale price, GST, tax-inclusive flag), picks CGST+SGST or IGST from the customer's state vs the branch's, and prices with `priceCart` from shared (line discount → bill discount apportioned by line → GST per line → rupee round-off). `/pos/quote` and the charge use the same code; the UI prices locally with the same function.
- **Charge (`POST /invoices`)** needs an open shift for the user in the branch. One transaction: `INVOICE` number → invoice + lines (customer details copied) → `SALE` stock movements → payments → `InvoicePosted` outbox row → idempotency row. Every bill needs a customer (no walk-in bills: the POS starts by finding the customer with `GET /customers/lookup?q=<mobile or email>`, or adds them on the spot); the charge is refused with a `customerId` field error otherwise. Unpaid balance = credit sale; its `dueDate` is the end of the day `creditDays` after today in `APP_TIMEZONE` (`endOfDayAfter`), so a 0-day bill is not overdue until the day ends. Discount above `pos.maxDiscountPercent` or credit above the customer's limit throws 403 `APPROVAL_REQUIRED` (`details.approvals`) unless the user holds `discount.override` / `credit.override`, or the body carries `override: { identifier, password }` of a manager of the same business who does (verified with bcrypt, recorded on the invoice and audited).
- **Bill email:** after a charge commits, if the customer has an email, `IInvoiceMailer.emailInBackground` sends the bill: HTML body from `invoiceMail` in `mail.templates.ts`, plus the A4 tax invoice as a PDF attachment built by `buildInvoicePdf` (`invoices/invoice-pdf.ts`, pdf-lib with the built-in Helvetica fonts, so "₹" is written "Rs."; it uses the print settings for terms, footer and signature). Sender name = the shop, reply-to = the business email. It runs inside `waitUntil` (`@vercel/functions`) so the counter never waits on SMTP and Vercel keeps the function alive until it is sent; failures are only logged ("Bill email failed").
- **Idempotency:** the POS sends `Idempotency-Key`; `(userId, key)` stores a hash of the body and the invoice id. Same key + same body → the first invoice (200); different body → 409; a concurrent duplicate hits the primary key and is answered with the winner.
- **Money after posting** never edits lines. Payments are append-only rows (`kind` null = receipt, `REVERSAL`, `REFUND`; negative amounts). Invoice `paidTotal` / `creditedTotal` / `status` are recomputed under `SELECT … FOR UPDATE` on the invoice row (`lockInvoice`). Cancel returns stock (`SALE_CANCEL`) and refunds by method; refused once a credit note exists. Credit notes (`CREDIT_NOTE` series) credit proportional amounts per returned quantity (the last units take exactly what's left), restock (`SALE_RETURN`) and refund any overpayment.
- **Old dues (opening balance):** `POST /invoices/opening-balance` (`dues.opening`) saves an invoice with `kind = OPENING_BALANCE` (series `OB`, no lines, zero tax, no shift, dated `asOfDate`, due after the customer's credit days). It counts wherever dues count (customer outstanding, receivables, ageing, overdue, payments) but every sales query filters `i.kind = 'SALE'` (`SALES` in `report.repository.ts`, dashboard sales); new sales queries must do the same. Print and credit notes are refused; cancel only while nothing is paid.
- **Phone scanner (`pos-scanner`):** a phone paired with the POS as a camera barcode scanner. `POST /pos/scan-sessions` (PC, `pos.use`) returns `{ id, token }`; the UI puts `/scan/<id>#<token>` in a QR code. The phone has no login: `POST /scan-sessions/:id/ping` and `/scans` (public, rate-limited per IP) carry the token in `x-scan-token` (only its SHA-256 hash is stored; business and branch come from the session row). The PC polls `GET /pos/scan-sessions/:id/scans?after=<last id>` about once a second (no websockets on Vercel) and feeds each code to the normal barcode lookup. One open session per user and branch; they expire after 12 h and are **hard-deleted** a day later (working rows, not business records, so the soft-delete rule doesn't apply).
- **Shifts:** `expected` per method = net payments with that shift id (+ opening cash for CASH); close stores counted vs expected and audits the variance.

## Dates without time

- `src/common/date-only.ts` holds the `YYYY-MM-DD` helpers (`todayIn(env.APP_TIMEZONE)`, `addDays`, `daysBetween`, `toDateOnly` / `fromDateOnly` for `@db.Date` columns).
- **Migration order:** name new migrations after the latest folder (currently `20261112110000_pos_scan_sessions`).

## Dashboard and reports

- **Scope:** `?branchId=` is a branch id or `all` (every active branch the user can access); without it, the `x-branch-id` header. Resolved by `resolveBranchScope` in `src/common/branch-scope.ts`. Dashboard routes need `dashboard.view`, report routes `report.view`.
- **Periods:** `from`/`to` are inclusive days in `APP_TIMEZONE` (default: month so far, max 366 days). Invoices filter on `invoice_date`, payments on `received_at`, credit notes on `created_at`. Cancelled invoices never count; in the registers they appear with zero amounts. GSTR-3B shows outward supplies only (no input tax credit, since purchases aren't recorded).
- **ReportRepository** holds all the read-only SQL (`$queryRaw`, numerics as text, summed in paise in the service). `DashboardService` reuses its open-invoice query for receivables, and `IStockService.list` (status LOW) for low stock.
- **Output:** a report is a `ReportResult` (shared). `format=csv|xlsx` turns it into a file in `report.export.ts` (Excel via `src/common/xlsx.ts`); downloads set `Content-Disposition` and skip the envelope. `gstr1.ts` and `tally.ts` are pure builders with unit tests in `phase6.service.test.ts`.
- **Adding a report:** add its name and definition to `REPORTS` in shared, a query to `ReportRepository`, and a `case` in `ReportService.run`; the UI index and viewer pick it up.

## Auth and users

- **Accounts:** shops register themselves (`POST /auth/register`, PENDING until the platform admin approves). Inside a shop, users with `user.manage` create staff via `/api/v1/users` (mobile required, email optional), assigning a role and branches, and can set a new password with `POST /users/:id/password`. Nobody can delete, deactivate or change the role of themselves; at least one active OWNER must remain; non-owners can only assign roles whose permissions they hold, and only their own branches; non-OWNER roles need at least one branch.
- **Roles & permissions:** a `Role` stores a `permissions text[]` of codes from `packages/shared/src/permissions.ts` (the single catalog; `GET /permissions` serves it). System roles have a `key` (`OWNER`, `BRANCH_MANAGER`, `COUNTER`, …). OWNER bypasses every permission and branch check and its role can't be edited. Routes guard with `requirePermission(...codes)` (any-of).
- **Branch scope:** `res.locals.auth` carries `isOwner`, `permissions` and `branchIds`. Use `canAccessBranch(auth, id)` in services; `requireBranch` / `optionalBranch` resolve the `x-branch-id` header into `res.locals.branchId`.
- **Audit:** inject `IAuditService` and call `record(auth, { action, entity, entityId, before, after })` for sensitive changes (pass a transaction client as the third argument inside `$transaction`). Secrets are stripped.
- **Number series:** `IDocumentSequenceService.next(tx, branchId, docType)` issues gap-free numbers like `INV-26-01874` per branch and financial year (April–March in `APP_TIMEZONE`); call it inside the transaction that creates the document.
  - The OWNER account comes from sign-up (or the seed's demo shop).
- **Login:** `{ identifier, password }`, where identifier is a mobile number or an email. The same 401 comes back for an unknown account, a wrong password or a non-ACTIVE user; only with the right password does a non-ACTIVE shop get 403 `BUSINESS_*`. Login records `lastLoginAt` and an `auth.login` audit entry. The JWT carries only `sub`; role, permissions, business and its status are re-read on every request.
- **Password reset / email confirm:** one-time tokens in `auth_tokens` (SHA-256 hashes; reset 30 min, confirm 48 h; a new link voids older ones). `forgot-password` always returns 200. Rate limits on `/auth/*` are in memory per instance (`middleware/rate-limit.ts`).
- **POS manager override** is `override: { identifier, password }`, and the manager must belong to the same business.
- **Password hash:** repository queries use a `publicUserSelect` whitelist, so `passwordHash` leaves the repository only through `findCredentialsByIdentifier` / `findCredentialsById`.
- **Refresh tokens:**
  - Login returns `{ user, token, refreshToken }` (register returns no tokens: the shop is pending).
  - Refresh tokens are opaque random strings. Only their SHA-256 hashes are stored, in `refresh_tokens` (`RefreshTokenRepository`).
  - `POST /auth/refresh` rotates the token: it revokes the old one and issues a new pair. Presenting an already-revoked token revokes all of that user's tokens.
  - `POST /auth/logout` revokes the token and always returns 200.
  - `PATCH /users/me/password` checks the current password and revokes all refresh tokens.
  - Rows are revoked via `revokedAt`, never deleted.
- Passwords are hashed with `bcryptjs` using `BCRYPT_ROUNDS` from `src/common/constants.ts`, and the zod schemas lowercase emails. The seed never overwrites an existing admin's password.

## Notes

- `package.json` is `"type": "commonjs"` with `module: NodeNext`, so relative imports are written without file extensions.
- `package.json` lists many transitive packages (e.g. `accepts`, `braces`, `debug`) as direct dependencies. The ones the code actually uses are `express`, `@prisma/*`, `pg`, `zod`, `dotenv`, `bcryptjs`, `jsonwebtoken`, `inversify`, `reflect-metadata` and `swagger-ui-express`.
- `dist/` is build output. Don't edit it.
