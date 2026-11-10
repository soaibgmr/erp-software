# ERP Software — Architecture & Design Patterns

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Last updated** | 2026-11-09 |
| **Related** | [PRD.md](PRD.md) · [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · `api/CLAUDE.md` |

This document lists the patterns the codebase uses and *where* each one applies. The backend patterns extend the conventions already in `api/` (see `api/CLAUDE.md`); don't replace them.

---

## 1. System overview

```
┌──────────────┐   HTTPS + clientid + Bearer   ┌─────────────────────────┐
│ ui/ (React)  │ ────────────────────────────▶ │ api/ (Express 5)        │
│ Vite SPA     │ ◀──────── envelope JSON ───── │ routes→controller→      │
└──────┬───────┘                               │ service→repository      │
       │ imports                               └──────────┬──────────────┘
       ▼                                                  │ Prisma 7
┌──────────────────┐                           ┌──────────▼──────────────┐
│ packages/shared  │ ◀──────── imports ──────── │ PostgreSQL              │
│ zod, GST, money  │                           │ + outbox_events table   │
└──────────────────┘                           └──────────▲──────────────┘
                                                          │ polls
                                               ┌──────────┴──────────────┐
                                               │ api/src/worker.ts        │──▶ WhatsApp BSP
                                               │ outbox dispatcher        │──▶ GSP (e-invoice)
                                               └──────────────────────────┘──▶ Payment gateway
                     Payment gateway / WhatsApp webhooks ──▶ api /webhooks/*
```

Repository layout:

```
erp-software/
├── package.json            # npm workspaces
├── docs/                   # PRD, plan, patterns, design system
├── packages/shared/src/    # schemas/, gst.ts, money.ts, amount-in-words.ts, reg-number.ts, enums.ts
├── api/src/
│   ├── modules/<domain>/   # routes, controller, service, repository, schema, types, docs, interfaces/
│   ├── integrations/       # whatsapp/, payments/, einvoice/  (adapters)
│   ├── outbox/             # dispatcher + handlers
│   ├── server.ts           # HTTP entry
│   └── worker.ts           # outbox worker entry
└── ui/src/
    ├── app/                # router, providers, AppShell (Sidebar, TopBar), hotkeys
    ├── components/ui/      # design-system primitives
    ├── features/<module>/  # api/, components/, pages/, hooks/
    ├── lib/                # api-client, query-client, format
    └── styles/             # tokens.css, tailwind config
```

---

## 2. Backend patterns

### 2.1 Layered feature module *(existing — keep)*
`*.routes.ts → *.controller.ts → *.service.ts → *.repository.ts`, with `*.schema.ts`, `*.types.ts`, `*.docs.ts`, `interfaces/`. Reference: `api/src/modules/users/`.
- **Routes** wire `validate()` + auth + controller method.
- **Controllers** read `res.locals.body/query/params`, call one service method, respond with `sendSuccess / sendCreated / sendPaginated` (`api/src/common/api-response.ts`).
- **Services** hold business rules and transactions; throw helpers from `api/src/common/http-error.ts`.
- **Repositories** are the only layer that touches Prisma.

Registering a module touches: `api/src/config/ioc.types.ts`, `api/src/config/inversify.config.ts`, `api/src/modules/index.routes.ts`, `api/src/docs/openapi.ts`.

### 2.2 Repository + Dependency Injection *(existing — keep)*
Services and repositories implement `I*` interfaces and are bound in singleton scope; every constructor parameter uses an explicit `@inject(TYPES.X)` (required under `tsx`). Services depend on interfaces, which makes adapters and test doubles swappable.

### 2.3 Unit of Work (transaction boundary)
Multi-table writes run in one `prisma.$transaction`. Repositories accept an optional transaction client so a service can compose them:

```ts
// service
return this.prisma.$transaction(async (tx) => {
  const number = await this.sequences.next(tx, branchId, 'INVOICE');
  const invoice = await this.invoices.create(tx, InvoiceFactory.fromCart(cart, number, taxes));
  await this.stock.post(tx, invoice.lines.map(toSaleMovement));
  await this.payments.createMany(tx, invoice.id, cart.payments);
  await this.outbox.add(tx, { type: 'InvoicePosted', invoiceId: invoice.id });
  return invoice;
}, { isolationLevel: 'ReadCommitted' });
```
Used by: invoice posting, invoice cancel, credit note, job card → invoice, GRN, stock transfer, shift close.

### 2.4 State machine (status transitions)
Job cards, invoices, purchase orders and transfers declare allowed transitions in one table; the service is the only place status changes.

```ts
export const JOB_CARD_TRANSITIONS: Record<JobCardStatus, JobCardStatus[]> = {
  DRAFT:              ['WAITING_FOR_BAY', 'CANCELLED'],
  WAITING_FOR_BAY:    ['IN_SERVICE', 'CANCELLED'],
  IN_SERVICE:         ['QUALITY_CHECK', 'WAITING_FOR_BAY'],
  QUALITY_CHECK:      ['READY_FOR_DELIVERY', 'IN_SERVICE'],
  READY_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED:          [],
  CANCELLED:          [],
};
```
Invalid transition → `conflict()` (409). Every transition writes a `JobCardStatusEvent` (actor, from, to, at). The transition table lives in `packages/shared` so the UI board only offers legal moves.

### 2.5 Strategy
Pluggable rules selected at runtime:
- **Tax strategy** — `IntraStateGst` (CGST+SGST), `InterStateGst` (IGST), `ExemptSupply`; chosen from branch state vs. place of supply.
- **Price mode** — tax-exclusive vs. tax-inclusive line calculation.
- **Discount policy** — per-role max %, manager override.
- **Payment method** — Cash (tendered/change), UPI (gateway QR), Card (reference), Credit (credit-limit check).
- **Numbering** — series format per document type.

### 2.6 Adapter / Ports & Adapters (integrations)
Services depend on ports; providers live under `api/src/integrations/` and are bound in Inversify based on env config. A `Noop`/`Sandbox` adapter is used in dev and tests.

| Port | Adapters |
|---|---|
| `INotificationChannel` | `WhatsAppCloudApiChannel`, `<Bsp>Channel`, `LogChannel` (dev) |
| `IPaymentGateway` | `RazorpayGateway` / `CashfreeGateway`, `FakeGateway` |
| `IEInvoiceProvider` | `<Gsp>Provider`, `SandboxEInvoiceProvider` |
| `IPdfRenderer` | headless-Chromium renderer of the print route (invoice PDF for WhatsApp) |

### 2.7 Factory
Builds complex aggregates in one place so every entry point creates them the same way:
- `InvoiceFactory.fromCart(cart, ctx)` — POS.
- `InvoiceFactory.fromJobCard(jobCard, ctx)` — workshop.
- `PurchaseOrderFactory.fromLowStock(items, supplier)`.

### 2.8 Append-only ledger
`StockLedger`, `Payment`, `AuditLog`, `JobCardStatusEvent` rows are inserted, never updated or deleted. Corrections are new rows (reversal). `BranchStock` caches `onHand`/`reserved` and is updated in the **same transaction** as the ledger insert, with a periodic reconciliation job that alerts on drift.

All stock changes go through one method:
```ts
interface IStockService {
  post(tx: Tx, movements: StockMovement[]): Promise<void>; // validates availability, locks rows, writes ledger + cache
}
```

### 2.9 Reservation
Job cards reserve parts (`StockReservation`), raising `BranchStock.reserved`. POS availability = `onHand − reserved`. Reservations are released on job card cancel, consumed on conversion to invoice.

### 2.10 Pessimistic locking for counters and stock
- **Document numbers:** `DocumentSequence` row read with `SELECT … FOR UPDATE` inside the posting transaction → gap-free per branch per FY.
- **Stock rows:** `BranchStock` rows for the cart's items are locked in a stable order (by `itemId`) to avoid deadlocks.

### 2.11 Idempotency key
`POST /invoices`, `POST /invoices/:id/payments` and payment webhooks accept a key. The first request stores `(key, userId, requestHash, responseBody)` in `IdempotencyKey`; a repeat returns the stored response; a repeat with a different body → 409. Protects against double charge on retries or double-pressing F12.

### 2.12 Transactional outbox + worker
Side effects to external systems are never called inside the request. The service writes an `OutboxEvent` in the same transaction; `worker.ts` delivers it with exponential backoff, marks `SENT`/`FAILED`, and surfaces failures in the notification bell. Events: `InvoicePosted`, `InvoiceCancelled`, `EstimateCreated`, `JobReadyForDelivery`, `ServiceDue`, `PaymentReminderDue`, `PurchaseOrderSent`.

### 2.13 Policy / guard (RBAC + branch scope)
Extends `AuthMiddleware` (`api/src/middleware/auth.ts`):
```ts
router.post('/:id/cancel',
  auth.requireAuth,
  auth.requirePermission('invoice.cancel'),
  branchScope,                      // resolves x-branch-id, checks UserBranch
  validate({ params, body }),
  controller.cancel);
```
Repositories always filter by `branchId` from `res.locals.branch`; owners may pass `branchId=all` for reads only.

### 2.14 Value objects
Immutable types in `packages/shared` with validation and formatting:
`Money` (decimal, en-IN format), `GstBreakup`, `Gstin`, `VehicleRegNo` (normalize `kl07cb4412` → `KL 07 CB 4412`), `MobileNumber`, `FinancialYear`.

### 2.15 Specification / query object
List endpoints map validated query DTOs (`ListInvoicesQuery`) to Prisma `where` objects in the repository through small composable builders (`byBranch`, `byDateRange`, `byStatus`, `search`), so filters behave the same on lists, exports and reports.

### 2.16 Audit (decorator-style helper)
A service-level helper wraps sensitive operations and writes `AuditLog` with before/after in the same transaction:
```ts
await this.audit.record(tx, { action: 'invoice.cancel', entity: 'Invoice', entityId, before, after, actor });
```

### 2.17 Read models for dashboard and reports
Dashboard and reports use dedicated read repositories with aggregate SQL (`$queryRaw` with typed results), not the write repositories. If needed, a `daily_sales_summary` table is refreshed by the outbox on `InvoicePosted`/`InvoiceCancelled` (CQRS-lite).

---

## 3. Frontend patterns (ui/)

### 3.1 Feature-sliced structure
`src/features/<module>/` owns its API hooks, pages and components (`pos`, `invoices`, `job-cards`, `inventory`, `customers`, `vehicles`, `purchases`, `dashboard`, `reports`, `settings`). Shared, domain-free UI lives in `src/components/ui/`. Features import from `components/ui` and `lib`, never from each other's internals (expose an `index.ts`).

### 3.2 Design tokens → theme
All colors, type sizes, radii and spacing come from CSS variables in `styles/tokens.css` (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)) mapped into the Tailwind theme. No hex values in components. Status → badge colour mapping is a single `statusTone` map.

### 3.3 Server state vs. client state
- **TanStack Query** for all API data, with query-key factories per feature (`invoiceKeys.list(filters)`, `invoiceKeys.detail(id)`), invalidation after mutations, and `placeholderData` for smooth pagination.
- **Zustand** only for POS state (cart, selected customer, payment draft, held carts cache) and UI prefs. Cart is persisted to `sessionStorage` so a refresh doesn't lose a sale.
- No global store for server data.

### 3.4 Typed API client
`lib/api-client.ts`: adds `clientid`, `Authorization`, `x-branch-id`; unwraps `{ success, data, meta }`; converts `{ error: { code, message, details } }` into `ApiError`; on 401 performs one refresh-token rotation and retries; queues concurrent requests during refresh.

### 3.5 Shared schemas in forms
React Hook Form + `zodResolver` with schemas imported from `packages/shared` — the same schemas the API uses in `validate()`. Server `details` are mapped back onto fields. Rule from the design: errors replace helper text and never shift layout.

### 3.6 Container / presentational
Pages (`pages/`) fetch and orchestrate; components (`components/`) receive props and render. Makes primitives and domain components reusable on print views and in the component gallery.

### 3.7 State-first data views
Every list/detail uses one wrapper that renders the four designed states:

```tsx
<QueryState query={stockQuery}
  loading={<TableSkeleton rows={6} />}
  empty={<EmptyState icon={FileText} title="No job cards yet" action={<Button>New job card</Button>} />}
  error={(e, retry) => <ErrorBanner title="Couldn't load stock levels" onRetry={retry} onViewCached={...} />}>
  {(data) => <StockTable rows={data} />}
</QueryState>
```
Skeleton rows match real row height; spinners only inside buttons.

### 3.8 Hotkey & command registry
A single `HotkeyProvider` registers global shortcuts (F2 POS, F3 search, F8 hold, F12 charge, Ctrl K command palette, Esc close) with scope (global vs. POS) and ignores keys while typing in inputs except where allowed. The command palette searches invoices, customers, vehicles and parts via one `/search` endpoint.

### 3.9 Scanner input detection
The POS search input treats a burst of characters (< 30 ms apart) ending in Enter as a scan → `GET /items/by-barcode/:code` → add to cart; slower typing is a search.

### 3.10 Autosave drafts
Job card form debounces changes (2 s) into `PATCH /job-cards/:id` while `DRAFT`, showing *Autosaved 11:52 AM*. Conflicts use `updatedAt` optimistic concurrency (409 → reload prompt).

### 3.11 Print views
Dedicated routes outside the app shell (`/print/invoice/:id?format=a4|thermal`) with `@page { size: A4 }` / 80 mm CSS. The same route is rendered by the API's PDF renderer for WhatsApp attachments, so screen, paper and PDF match.

### 3.12 Optimistic UI — only where safe
Optimistic updates for low-risk changes (workshop board drag, chip toggles). Never for charge, payments, cancellations or stock — those wait for the server and show a button spinner (*Saving…*).

### 3.13 Permission-aware UI
`useCan('invoice.cancel')` hides or disables actions; the sidebar is generated from a route config annotated with permissions. The server remains the authority.

---

## 4. Cross-cutting conventions

| Topic | Rule |
|---|---|
| Money | Decimal everywhere; format only at the edge (`formatINR`); KPI numbers use tabular figures, right-aligned in tables. |
| Dates | Stored UTC (`Timestamptz`), displayed in `Asia/Kolkata`; financial year helper in shared. |
| IDs vs numbers | UUIDs internally; human numbers (`INV-24-01874`) for display and search. |
| Errors | API: `http-error` helpers → envelope. UI: toast for actions, banner for page loads, field errors for forms. |
| Logging | pino with request id; never log tokens, full GSTIN credentials or payment payloads. |
| Testing | Shared: unit tests (GST, money, words). API: service unit tests + Supertest integration + concurrency tests. UI: component tests for primitives, Playwright smoke for POS charge and job card flows. |
| Feature flags | Settings-based flags for e-invoice, WhatsApp, UPI gateway, negative stock. |

## 5. Pattern → module map

| Module | Key patterns |
|---|---|
| POS / Invoices | Unit of Work, Factory, Tax Strategy, Idempotency, Sequence lock, Ledger, Outbox |
| Job cards | State machine, Reservation, Factory, Autosave, Outbox (estimate approval) |
| Inventory | Ledger, Pessimistic locking, Specification |
| Purchases | Factory (from low stock), Unit of Work (GRN), Ledger |
| Integrations | Adapter, Outbox, Idempotency (webhooks) |
| Dashboard / Reports | Read models (CQRS-lite), Specification |
| Users / Settings | Policy guard, Audit |
