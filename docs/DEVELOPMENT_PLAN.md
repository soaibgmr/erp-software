# ERP Software — Phase-wise Development Plan

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Last updated** | 2026-11-09 |
| **Related** | [PRD.md](PRD.md) · [DESIGN_PATTERNS.md](DESIGN_PATTERNS.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |

Requirement IDs (`M5.3` etc.) refer to [PRD.md §4](PRD.md#4-modules-and-functional-requirements).

---

## 1. Starting point

| Area | Today | Action |
|---|---|---|
| `api/` | Express 5 + TypeScript + Prisma 7 + PostgreSQL + Inversify template. Modules: `health`, `users` (register/login/refresh/logout, roles `ADMIN | USER`). Conventions in `api/CLAUDE.md`. | Keep and extend. Every new module follows the `users` module layout. |
| `api/docs/` | PRD and PDFs from a previous healthcare project. | Remove; this `docs/` folder replaces them. |
| `ui/` | A copy of the API template, not a frontend. | Replace with a Vite + React + TypeScript app. |
| Tooling | No linter, no tests, no CI. Only `npm run typecheck`. | Add in Phase 0. |

## 2. Target stack

| Layer | Choice |
|---|---|
| API | Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL 16, Inversify, zod, pino, Vitest + Supertest |
| Worker | Same codebase, separate entry `src/worker.ts` for outbox (WhatsApp, e-invoice, reminders) |
| UI | React 19, Vite, TypeScript, React Router, TanStack Query, React Hook Form + zod, Zustand (POS only), Tailwind CSS with design tokens, lucide-react icons, Recharts |
| Shared | `packages/shared`: zod schemas, enums, GST/money/amount-in-words, reg-number normalizer |
| Repo | npm workspaces at the root: `api`, `ui`, `packages/shared` |
| Delivery | Docker images, GitHub Actions (typecheck, lint, test, build, migrations check) |

## 3. Timeline

Estimates assume 2 full-stack developers and 1 part-time designer/QA. Phases are sequential on the critical path; integration groundwork (template approval, GSP/gateway sandbox) starts in Phase 1 because of external lead time.

| Phase | Name | Weeks | Cumulative |
|---|---|---|---|
| 0 | Foundation & design system | 2 | 2 |
| 1 | Masters, RBAC, branches, customers | 2 | 4 |
| 2 | Items & inventory | 2 | 6 |
| 3 | POS billing & invoices | 3 | 9 |
| 4 | ~~Job cards (workshop)~~ removed | 0 | 9 |
| 5 | ~~Purchases & suppliers~~ removed (2026-11-10) | 0 | 14 |
| 6 | Dashboard & reports | 2 | 16 |
| 7 | Integrations | 3 | 19 |
| 8 | Hardening, migration, UAT, go-live | 2 | 21 |

**Milestones**
- **MVP-1 (end of Phase 3, week 9):** counter billing live in a pilot branch — items, stock, POS, invoices, A4/thermal print.
- **v1.0 (end of Phase 8, week 21):** all branches, purchases, reports, integrations.

### Progress

| Phase | Status | Notes |
|---|---|---|
| 0 | ✅ Done (2026-11-09) | Monorepo, shared package, oxlint + Prettier, Vitest/Supertest, pino, CI workflow, React app shell and design-system components, `/dev/components` gallery |
| 1 | ✅ Done (2026-11-09) | Business, branches, roles/permissions, users with branches, settings (tax/print/pos), number series, customers, audit log, all with screens |
| 2 | ✅ Done (2026-11-09) | Catalog masters, items, labour services, ledger-based stock with adjustments (approval above a limit), inter-branch transfers, CSV import with preview, barcode labels, inventory screens |
| 3 | ✅ Done (2026-11-09) | Shifts, POS (quote, held carts, charge with idempotency, manager override), invoices, payments and reversals, cancellation, credit notes, A4 and 80 mm print, shift report |
| 5 | ❌ Removed (2026-11-10) | Built on 2026-11-09, then removed at the owner's request: suppliers, purchase orders, goods receipts, supplier bills and payments, payables, debit notes and the order list are gone (data backed up to `backups/`). Was: Suppliers with items supplied, purchase orders (draft → sent, from low stock, print), goods receipts against a PO with partial receipt or direct, supplier bills matched to receipts, supplier payments and reversals, payables ageing, debit notes (purchase returns) |
| 6 | ✅ Done (2026-11-09) | Dashboard (sales / collected / receivables / payables KPIs with change vs previous period, 14-day parts vs labour chart, recent invoices, low stock, branch / all-branches toggle, Excel export); 11 reports as JSON, CSV and Excel; GSTR-1 portal JSON; Tally vouchers XML |
| 7–8 | Not started | |

**Deviations from the original Phase 0–1 plan**
- **Lint:** oxlint instead of ESLint. `typescript-eslint` supports TypeScript < 6.1, and the repo is on TypeScript 7.
- **Permissions storage:** `roles.permissions text[]` holding codes from `packages/shared/src/permissions.ts`, instead of separate `Permission` / `RolePermission` tables. Same behaviour, one catalog in code.
- **Registration:** public `POST /auth/register` was removed. Accounts are created by users with `user.manage`.
- **Command palette:** searches pages and customers for now. Invoices and parts join as their modules land.
- **Customer mobile uniqueness:** enforced in the service among non-deleted customers (a DB unique index would also block re-using a deleted customer's number).

**Phase 5 notes**
- **One `purchases` module** (`api/src/modules/purchases/`) holds purchase orders, goods receipts, purchase invoices, supplier payments and debit notes, like `invoices` holds invoices, payments and credit notes. `suppliers` is its own module.
- **Purchase orders** are never deleted: `POST /:id/cancel` (before anything is received) and `POST /:id/close` (partly received, rest not coming) replace DELETE. Allowed status changes are one table, `PURCHASE_ORDER_TRANSITIONS` in shared.
- **Purchase invoices** have no number of their own; they carry the supplier's bill number (unique per supplier among non-cancelled bills). They are never edited; a bill entered by mistake is cancelled while nothing is paid or debited.
- **Every bill line references a goods receipt line**: goods are received first, then billed. Rate, GST and discount come from the supplier's bill; the response shows the receipt cost next to it.
- **Supplier payments** are append-only with REVERSAL rows (same as sales payments); added `POST /supplier-payments/:id/reverse` and `GET /purchase-invoices/payables-ageing`.
- **Debit notes** use a new `DEBIT_NOTE` number series (`DN`). Against a bill they can't exceed what is unpaid on it (reverse a payment first); there is no supplier refund tracking yet.
- **Order list** (added after Phase 5): out-of-stock items join a per-branch order list automatically; anyone who sees stock can add items (item page or the list); purchase staff turn ticked rows into draft POs, one per supplier. `/purchases/order-list`, also a tab under Inventory.
- **Goods receipts** set the item's purchase price to the latest receipt cost.
- **Low stock:** the dashboard doesn't exist yet (Phase 6). *Order low stock* sits on the Inventory → Low stock filter and opens `/purchases?lowStock=1`; Phase 6's dashboard button should link there.
- **Sending a PO** writes a `PurchaseOrderSent` outbox event; delivery by WhatsApp/PDF arrives with the Phase 7 worker. Until then, print the PO from `/print/purchase-order/:id`.

**Phase 6 notes**
- **Two modules:** `dashboard` and `reports`. Every report returns one generic shape (`ReportResult`: titled tables of typed columns, rows and totals, in `packages/shared/src/schemas/reports.ts`), so the UI renders all of them with one viewer and the API writes CSV / Excel from the same data. The catalog (`REPORTS`) is shared, so the Reports index comes from it.
- **Workshop KPI replaced:** *Open job cards* (M9.2) and *Workshop today* (M9.4) went with job cards; the fourth KPI card is **Payables** (owed to suppliers, overdue, due this week). Report M10.6 (workshop) is dropped.
- **Extra reports:** `payables-ageing` (M10.7 "payables" across branches) and the sales register grouped by day, customer, item, category or payment mode (M10.1). Slow / non-moving items (M10.5) are the *Days since sale* column of stock valuation.
- **Excel without a dependency:** `api/src/common/xlsx.ts` writes .xlsx (zip + XML via `node:zlib`). Downloads are the one exception to the JSON envelope; errors still use it.
- **GSTR-1:** filed per GSTIN, so a scope whose branches have different GSTINs (branch GSTIN, else the business's) is refused, as is a business with no GSTIN. B2C large = unregistered, inter-state, above ₹1,00,000. Credit notes on B2C small invoices are netted into B2CS. `format=portal` downloads the offline-tool JSON. **Not yet validated against the GST offline tool** (exit criterion open); the local database has no GSTIN, so it was checked by unit tests only.
- **Tally:** fixed ledger names (`Sales @ 18%`, `Output CGST`, `Cash`, `Bank`, `Cash Sales`, `Round Off`…, see `reports/tally.ts`); each voucher's residue goes to Round Off so it always balances. Not yet imported into a real Tally company.
- **Indexes:** the existing `(branch_id, invoice_date)`, `(branch_id, received_at)` and `purchase_invoices (branch_id, invoice_date)` indexes cover the queries; no summary table and no migration. Revisit if dashboard queries pass ~200 ms.
- **Reconciliation (verified on local data, 2026-10-11 to 2026-11-09, Main branch):** dashboard sales ₹70,744.00 = sales register total; dashboard collected ₹62,286.00 = register by payment mode (net); 104 Tally vouchers, all balanced.

**Plan change (2026-11-10): no purchasing.** The owner asked to remove the supplier/purchase side completely. Stock comes in through stock adjustments (opening stock), transfers and the CSV import; item purchase prices are edited by hand. The dashboard has no Payables card, GSTR-3B shows outward tax only, Tally export has sales and receipts only. Customers' old dues (opening balance, `OB` series) were added the same day.

**Plan change (2026-11-09)**
- **No workshop: job cards and vehicles are removed.** The business sells parts and doesn't provide service, so Phase 4 (job cards, vehicles, bays, technicians, estimates, service reminders, workshop board) is dropped, along with the Workshop sidebar section, the `jobcard.*` permissions, the Service advisor and Technician roles and the job card number series. Vehicle makes and models stay in Inventory for part compatibility. Later phases lose their workshop parts (dashboard workshop widget, technician report, WhatsApp estimate / ready-for-delivery / service-reminder messages).

**Deviations in Phase 3**
- **Manager override** is a manager's email + password entered at the counter (the PRD says PIN; users have no PIN yet). The server checks the approver's role, branch and permission and records them on the invoice and in the audit log.
- **New permission `credit.override`** (Branch manager, by migration) for credit beyond a customer's limit; discounts use the existing `discount.override` against `pos.maxDiscountPercent`.
- **Item prices aren't editable at the POS**: lines use the master sale price; reductions are line or bill discounts, so they count against the discount limit.
- **Status `DRAFT` isn't used** (the POS posts directly). `OVERDUE` is derived on read (unpaid past the due date = invoice date + customer credit days).
- **Refunds:** cancelling an invoice refunds every payment by its method; a credit note refunds only what the customer paid above the reduced total, by the chosen method. Both are negative `payments` rows, so shift reports reconcile.
- **POS cart state** uses a reducer persisted to `sessionStorage` instead of Zustand (no new dependency).
- **WhatsApp send, UPI QR and e-invoice** wait for Phase 7. `outbox_events` rows (`InvoicePosted`, `InvoiceCancelled`) are already written for the Phase 7 worker.
- **Connection-pool rule:** inside a transaction every query must use the transaction client. `StockService.post` now takes `allowNegative` from the caller (read before the transaction) and the number series reads last year's format on the same client; before this, 20 parallel charges exhausted the pool.
- **Verified:** 20 parallel charges get distinct, consecutive numbers; the POS and A4 design totals (₹6,461 and ₹4,814) are unit tests.

**Deviations in Phase 2**
- **PATCH schemas:** zod 4's `.partial()` keeps `.default()` values, so a PATCH of one field reset every defaulted field (customer type and credit, user branches and status, settings). All update schemas now use `patchOf()` from `packages/shared/src/schemas/common.ts`, which fixes this for the Phase 1 modules too.
- **New permission `stock.approve`** (granted to Branch manager by the migration): approves adjustments whose value at purchase price exceeds the new `inventory.adjustmentApprovalLimit` setting (default ₹5,000).
- **Number series:** `STOCK_ADJUSTMENT` (`ADJ`) and `STOCK_TRANSFER` (`STR`) added to `DocumentType`.
- **Transfers** are dispatch → receive in full (no partial receipt); the sender can cancel while in transit. In-transit quantity is kept on the receiver's `branch_stock.in_transit`.
- **Opening stock** comes from an `OPENING_STOCK` adjustment or the CSV import; the import posts it only for items with no ledger history in the branch.
- **Search performance** (50k items, local PostgreSQL 16): two-word fuzzy search p95 79 ms, exact SKU/barcode p95 28 ms. The planner seq-scans at this size; the trigram indexes take over as the table grows.
- **Reservations** (`BranchStock.reserved`) are in the schema and respected by availability checks; nothing creates reservations now that job cards are out of scope, so `reserved` stays 0.

---

## Phase 0 — Foundation & design system (2 weeks)

**Goal:** a clean monorepo, quality gates, and a UI shell that matches the designs.

### Repo & API
- [x] Root `package.json` with npm workspaces `api`, `ui`, `packages/shared`; rename `project-template-api` → `@erp-software/api`.
- [x] Remove healthcare leftovers (`api/docs/*`, `ui/docs/*`).
- [x] oxlint + Prettier (shared config), Vitest + Supertest with a test database, pino request logging with request id.
- [x] `APP_TIMEZONE=Asia/Kolkata` default; add `CORS_ORIGIN` to the env schema.
- [x] `packages/shared`: `money.ts` (decimal helpers, en-IN formatting), `gst.ts` skeleton, `amount-in-words.ts`, `reg-number.ts`, shared enums.
- [x] GitHub Actions: install, typecheck, lint, test, build for all workspaces.

### UI
- [x] Replace `ui/` with Vite + React + TS; path aliases; env `VITE_API_URL`, `VITE_CLIENT_ID`.
- [x] Tailwind theme from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) tokens; Inter font; tabular numbers utility.
- [x] API client: base URL, `clientid` header, Bearer token, refresh-token rotation, envelope unwrapping, typed `ApiError`.
- [x] Primitives: `Button`, `IconButton`, `Badge`/`StatusBadge`, `Field`, `Input`, `Select`, `Textarea`, `Checkbox`, `SegmentedControl` (fuel level, range toggle), `Chip` (service types, categories), `Modal`/`ConfirmDialog`, `Menu`, `DataTable`, `Skeleton`, `EmptyState`, `ErrorBanner`, `Toast`, `KpiCard`, `Card`.
- [x] App shell: `Sidebar` (groups, active state, badges, user card), `TopBar` (search with Ctrl K, New bill, bell, user menu), layout with 24 px page padding.
- [x] Hotkey registry (F2, F3, F8, F12, Ctrl K) and command palette skeleton.
- [x] Login page using the existing `/auth/login`.
- [x] `/dev/components` gallery page reproducing the design-system board.

**Exit criteria**
- `npm run typecheck && npm run lint && npm test` passes in CI for all workspaces.
- Login works against the API; shell renders with sidebar and top bar per design.
- Component gallery visually matches the Design System v2 image; all four state patterns render.

---

## Phase 1 — Masters, RBAC, branches, customers (2 weeks)

**PRD:** M1.1–M1.7, M2.1–M2.5, M12 (foundation).

### API modules
| Module | Endpoints (under `/api/v1`) |
|---|---|
| `business` | `GET/PATCH /business` |
| `branches` | `GET/POST /branches`, `GET/PATCH/DELETE /branches/:id` |
| `roles` | `GET/POST /roles`, `PATCH /roles/:id`, `GET /permissions` |
| `users` (extend) | add `roleId`, `branchIds`; `GET /users/me` returns permissions + branches |
| `settings` | `GET/PATCH /settings/:group` (tax, print, pos) |
| `document-sequences` | `GET /document-sequences`, `PATCH /document-sequences/:id` (prefix/padding only) |
| `customers` | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id`, `GET /customers/lookup?mobile=` |
| `audit` | `GET /audit-logs` (owner) |

- [x] Replace `ADMIN | USER` with role + permission model; seed default roles (Owner, Branch manager, Counter, Storekeeper, Accountant; Service advisor and Technician were removed with job cards).
- [x] `requirePermission()` and `branchScope` middleware (extends `api/src/middleware/auth.ts`).
- [x] `DocumentSequence` service with row lock (used from Phase 3).
- [x] GSTIN validator (format + checksum + state code) and mobile validator in `packages/shared`.
- [ ] Start external lead-time items: WhatsApp BSP account and template submission; GSP sandbox; payment gateway sandbox. *(business task — not code)*

### UI
- [x] Settings: Business profile, Branches, Users & roles (permission matrix), Tax, Print, POS, Number series.
- [x] Branch switcher in sidebar header; menu items hidden by permission.
- [x] Customers: list (search, type filter), detail (tabs: vehicles, invoices, payments), create/edit form (2-column, errors replace helper text).

**Exit criteria**
- A Counter user sees only Sales menus for their branch; API returns 403 for other branches' data (tests).
- Customer CRUD validates mobile and GSTIN; duplicate mobile → 409.

---

## Phase 2 — Items & inventory (2 weeks)

**PRD:** M4.1–M4.9.

### API modules
| Module | Endpoints |
|---|---|
| `items` | `GET/POST /items`, `GET/PATCH/DELETE /items/:id`, `GET /items/search?q=` (name/SKU/OEM/barcode, fast), `GET /items/by-barcode/:code` |
| `catalog` | `/item-categories`, `/brands`, `/hsn-sac`, `/vehicle-makes`, `/vehicle-models` |
| `labour-services` | `GET/POST /labour-services`, `PATCH/DELETE /labour-services/:id` |
| `stock` | `GET /stock` (per branch, filters, low-stock), `GET /stock/:itemId/ledger`, `PATCH /stock/:itemId/settings`, `GET/POST /stock/adjustments`, `POST /stock/adjustments/:id/approve|reject`, `GET/POST /stock/transfers`, `POST /stock/transfers/:id/receive|cancel`, `POST /stock/import` (preview + commit) |

- [x] `StockLedger` + `BranchStock` with a single `StockService.post(movements[], tx)` used by every module.
- [x] Trigram / prefix indexes for item search (pg_trgm).
- [x] CSV import with row-level validation report.

### UI
- [x] Inventory list: search, category/brand filters, stock badges (in stock / low / out), branch column for owners.
- [x] Item form (pricing, tax, barcodes, compatibility), labour service form.
- [x] Item ledger view; adjustment and transfer forms; import wizard; barcode label print page.

**Exit criteria**
- Property test: after random movements, `BranchStock.onHand` = sum of ledger.
- Search returns in < 150 ms p95 on 50k seeded items.

---

## Phase 3 — POS billing & invoices (3 weeks)

**PRD:** M5.1–M5.11, M6.1–M6.8.

### API modules
| Module | Endpoints |
|---|---|
| `shifts` | `POST /shifts/open`, `POST /shifts/:id/close`, `GET /shifts/current`, `GET /shifts/:id/report` |
| `pos` | `POST /pos/quote` (server-side totals for a cart), `GET/POST /pos/held-carts`, `DELETE /pos/held-carts/:id` |
| `invoices` | `POST /invoices` (charge; `Idempotency-Key`), `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/cancel`, `GET /invoices/:id/print?format=a4|thermal` |
| `payments` | `POST /invoices/:id/payments`, `POST /payments/:id/reverse` |
| `credit-notes` | `POST /credit-notes`, `GET /credit-notes`, `GET /credit-notes/:id` |

- [x] GST engine in `packages/shared/gst.ts` (Strategy per supply type); same code powers UI preview and server posting (`priceCart` in `packages/shared/src/pricing.ts`).
- [x] `InvoicePostingService`: one transaction → sequence number → lines → tax summary → stock ledger → payments → outbox event.
- [x] Discount limits by role and manager override (audited).
- [x] Tests: both design examples, IGST case, tax-inclusive items, bill discount apportioning, idempotent retry, cancel restores stock (unit); 20 concurrent charges → unique gap-free numbers (against PostgreSQL).

### UI
- [x] POS screen per design: own header with shortcut hints, scanner-focused search, category chips, product tiles with stock states and cart badges, cart panel with steppers, customer attach/change, discount, totals, payment mode buttons, split payment dialog, Hold (F8), Charge (F12) in yellow.
- [x] Held carts drawer; shift open/close dialogs.
- [x] Invoices list with filters and status badges; invoice detail; row menu (View, Print, Send on WhatsApp, Cancel invoice) per design; cancel confirm modal.
- [x] Print routes: A4 invoice per design, 80 mm receipt; success toast with Print.

**Exit criteria**
- The POS design cart reproduces ₹6,461 and the invoice design reproduces ₹4,814 exactly.
- Pilot cashier completes a scanned 5-item sale in < 30 s.
- **MVP-1:** pilot branch billing in production-like staging.

---

## Phase 4 — Removed

Job cards and the workshop (vehicles, bays, technicians, estimates, service reminders, workshop board) are out of scope: the business sells parts and doesn't provide service. See *Plan change* above.

---|---|
| `bays` | `GET/POST /bays`, `PATCH /bays/:id` |
| `job-cards` | `GET /job-cards/lookup?regNo=` (last job card for the vehicle: customer, make/model, last odometer), `GET/POST /job-cards`, `GET/PATCH /job-cards/:id` (draft autosave), `POST /job-cards/:id/lines`, `PATCH/DELETE /job-cards/:id/lines/:lineId`, `POST /job-cards/:id/transition` (`{ to }`), `POST /job-cards/:id/reserve`, `POST /job-cards/:id/approval`, `POST /job-cards/:id/advance`, `POST /job-cards/:id/invoice` |
| `technicians` | `GET /technicians` (with open job count) |
| `service-reminders` | `GET /service-reminders`, rules per service type |

- [ ] Job card state machine with transition table and `JobCardStatusEvent` history.
- [ ] Stock reservations (reduce available, not on-hand).
- [ ] `InvoiceFactory.fromJobCard()` reusing the Phase 3 posting service.

### UI
- [ ] New job card per design: reg-number-first lookup with returning-customer hint, make/model select, odometer with unit and last-visit hint, fuel level segmented control, service-type chips, complaint, technician/bay/promised delivery, estimate table with Add labour / Add part, sticky Summary card (labour, parts, GST, estimate total, advance, WhatsApp checkbox), low-stock warning callout with Reserve action, autosave indicator, footer actions.
- [ ] Job card list and detail; status timeline.
- [ ] Workshop board (Kanban by status, drag to move, delayed highlight).

**Exit criteria**
- Converting a job card produces an invoice with labour + parts, applies the advance, releases reservations.
- Reserved parts show as unavailable in the POS.
- **MVP-2:** pilot workshop running job cards end to end.

---

## Phase 5 — Purchases & suppliers (2 weeks)

**PRD:** M8.1–M8.6.

| Module | Endpoints |
|---|---|
| `suppliers` | CRUD `/suppliers` |
| `purchase-orders` | List/create/get/edit draft `/purchase-orders`, `POST /purchase-orders/from-low-stock`, `POST /purchase-orders/:id/send`, `/:id/cancel`, `/:id/close` |
| `goods-receipts` | `GET`/`POST /goods-receipts`, `GET /goods-receipts/:id`, `GET /goods-receipts/open-lines` |
| `purchase-invoices` | List/create/get `/purchase-invoices`, `POST /purchase-invoices/:id/cancel`, `POST /purchase-invoices/:id/payments`, `GET /purchase-invoices/payables-ageing`, `POST /supplier-payments/:id/reverse` |
| `debit-notes` | `GET`/`POST /debit-notes`, `GET /debit-notes/:id` |

- [x] UI: supplier list/form/detail, PO builder (prefilled from low stock) with print, GRN against PO with partial receipt, purchase invoice matching, payments, payables ageing, purchase returns.

**Exit criteria**
- PO → GRN → purchase invoice is traceable; GRN increases stock via ledger; dashboard *Create purchase order* opens a prefilled PO.

---

## Phase 6 — Dashboard & reports (2 weeks)

**PRD:** M9.1–M9.7, M10.1–M10.8.

| Module | Endpoints |
|---|---|
| `dashboard` | `GET /dashboard/summary?range=today|7d|30d&branchId=`, `GET /dashboard/sales-trend?days=14`, `GET /dashboard/low-stock` |
| `reports` | `GET /reports/:name?from&to&branchId&format=json|csv|xlsx` for sales-register, day-book, shift, gstr1, gstr3b, hsn-summary, receivables-ageing, stock-valuation, stock-movement, purchase-register, payables-ageing (`format=portal` = GSTR-1 JSON); `GET /reports/tally-export?vouchers=sales,purchases,payments` |

- [x] Aggregation queries with indexes on `(branchId, invoiceDate)`; consider materialized daily summary table if needed.
- [x] UI: Dashboard per design (KPI cards with delta badges, 14-day sales bar chart, Recent invoices, Low stock, range toggle, Export); Reports index and report viewer with filters and export.

**Exit criteria**
- Dashboard totals reconcile with the sales register for the same range and branch.
- GSTR-1 JSON validates against the GST offline tool schema.

---

## Phase 7 — Integrations (3 weeks)

**PRD:** M6.9–M6.10, M11.1–M11.7.

- [ ] **Outbox worker** (`src/worker.ts`): polls `OutboxEvent`, dispatches to handlers, retries with exponential backoff, dead-letter status visible in UI.
- [ ] **WhatsApp** adapter (`INotificationChannel`): invoice PDF, payment reminder; delivery webhooks update `NotificationLog`.
- [ ] **UPI gateway** adapter (`IPaymentGateway`): create dynamic QR / payment link, signed webhook → payment recorded (idempotent), POS polls status while the QR is shown.
- [ ] **E-invoice / e-way bill** adapter (`IEInvoiceProvider`): generate/cancel IRN, store ack no./date/signed QR, print on invoice; e-way bill generation.
- [ ] **Thermal printing**: tuned 80 mm CSS; optional QZ Tray direct print with fallback to browser print.
- [ ] **Scanner**: fast-keystroke detection to separate scans from typing; configurable suffix.
- [ ] Notification bell feed and Settings → Integrations pages (credentials, test buttons, logs).

**Exit criteria**
- Each integration passes sandbox tests including failure and retry; an integration outage never blocks posting an invoice.

---

## Phase 8 — Hardening, migration, UAT, go-live (2 weeks)

- [ ] Security: rate limits (auth, webhooks, search), helmet/CORS, dependency audit, permission matrix test (every route × every role), secrets review.
- [ ] Audit coverage for all M12.1 actions.
- [ ] Performance: POS search and posting load tests; slow query review; indexes.
- [ ] Ops: Dockerfiles, compose for staging, CI/CD deploy with `prisma migrate deploy`, daily backups + restore drill, uptime and error monitoring, log retention.
- [ ] Data migration scripts: customers, items, opening stock, outstanding balances; dry run on staging and reconciliation report.
- [ ] UAT scripts per role; training sessions for counter and store staff; printed shortcut card.
- [ ] Go-live checklist: series reset for the FY, printers tested, WhatsApp templates approved, GSP production credentials, rollback plan.

**Exit criteria**
- UAT sign-off by owner and branch managers; restore drill succeeds; all branches live.

---

## 4. Screen → requirement → phase traceability

| Design screen | PRD | Phase |
|---|---|---|
| Design system v2 | Cross-cutting UI, [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | 0 |
| Component · Sidebar | Cross-cutting UI, M1.2 (branch), M7 badge | 0, 1 |
| Component · Top bar | Cross-cutting UI, M2.5 (search), M11.6 (bell), M5.1 (New bill) | 0, 7 |
| Empty, loading & error states | Cross-cutting UI | 0 (primitives), every phase |
| POS billing | M5.1–M5.11, M11.2, M11.4 | 3, 7 |
| Invoice print · A4 | M6.1, M6.9, M3.5 | 3, 4, 7 |
| Dashboard | M9.1–M9.7 | 6 |
| Dropdown & modal (design system) | M6.5, M6.7 | 3 |

## 5. Definition of done (every module)

- Follows the module layout and registration steps in `api/CLAUDE.md` and [DESIGN_PATTERNS.md](DESIGN_PATTERNS.md).
- Zod schemas shared from `packages/shared` where the UI also needs them.
- OpenAPI paths and response schemas added in `*.docs.ts`.
- Unit tests for services, integration tests for routes, permission tests for each role.
- UI screen implements loading, empty, error and no-results states.
- Reviewed migration SQL; no edits to applied migrations.
- Audit entries for sensitive actions.

## 6. Risks to the schedule

| Risk | Mitigation |
|---|---|
| WhatsApp template approval delays | Submit templates in Phase 1; fall back to SMS-free manual share link |
| GSP onboarding/sandbox delays | Choose GSP by end of Phase 1; e-invoice is behind a feature flag |
| GST edge cases found late | Tax test suite written in Phase 3 with accountant review |
| Data migration quality | Get sample export in Phase 1; build importer early (Phase 2 CSV import) |
| Printer/scanner hardware variety | Collect branch hardware list in Phase 0; test on real devices in Phase 3 |
