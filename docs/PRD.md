# ERP Software — Product Requirements Document

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Last updated** | 2026-11-09 |
| **Source** | Design screens v2: Design system, Dashboard, POS billing, New job card, Invoice print (A4), Sidebar, Top bar, Empty/loading/error states |
| **Scope** | Backend API (`api/`), React web app (`ui/`), shared package (`packages/shared/`), integrations |
| **Related** | [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) · [DESIGN_PATTERNS.md](DESIGN_PATTERNS.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |

---

## 1. Summary

ERP Software is a web ERP for automobile workshops that also sell spare parts over the counter. One business runs several branches (for example *Kochi · Main branch*). Each branch has counter staff who bill parts at a POS, service advisors who open job cards when a vehicle arrives, technicians who work in bays, and a store that buys and holds stock.

The system covers POS billing, workshop job cards, GST-compliant invoicing, inventory, purchases, receivables, dashboards and reports. It also connects to WhatsApp, a UPI/payment gateway, the GST e-invoice/e-way bill system, barcode scanners and thermal printers.

## 2. Goals

1. **Fast counter billing.** A counter sale with a barcode scanner takes under 30 seconds and can be done keyboard-only (F2 POS, F3 search, F8 hold, F12 charge).
2. **Workshop visibility.** Every vehicle is tracked from arrival to delivery: job card, estimate, approval, bay, technician, status, invoice.
3. **GST-correct invoices.** Every invoice gets the right CGST/SGST or IGST split, HSN/SAC codes, round-off, amount in words, and an IRN for B2B invoices that need one.
4. **Trustworthy stock.** Every stock change is a ledger entry. Parts on a job card can be reserved so the counter can't sell them.
5. **Owner overview.** One dashboard shows today's sales, collections, open job cards, receivables and low stock for a branch or for all branches.

### Non-goals (v1)

- Full accounting (general ledger, balance sheet, P&L). Data is exported to Tally instead.
- Payroll and HR.
- Native mobile apps. The web app must still work on a tablet for the workshop board.
- Customer self-service portal and online booking.
- Multi-tenant SaaS (several unrelated businesses on one deployment).
- Insurance claim workflow.
- Offline POS that keeps billing while the server is unreachable. v1 is online-only and shows cached data read-only.

## 3. Users and roles

Permissions are role-based and scoped to the branches a user is assigned to.

| Role | Who | Main screens / needs |
|---|---|---|
| **Owner / Admin** | Business owner, IT admin | Everything across all branches; settings, users, reports |
| **Branch manager** | Runs one branch | Branch dashboard; approves discounts above limit, invoice cancellation, credit overrides, stock adjustments |
| **Counter** | Cashier, e.g. *Anil Nair · Counter · Shift 1* | POS billing, invoices, customers, collecting payments, opening/closing a shift |
| **Service advisor** | Front desk of the workshop | Job cards, vehicles, estimates, customer approval, delivery |
| **Technician** | Works in a bay | Assigned jobs; moves status (in service → quality check); adds parts used. Prices hidden by default |
| **Storekeeper / Purchase** | Store-room staff | Inventory, stock adjustments, transfers, purchase orders, goods receipt, suppliers |
| **Accountant** | Back office | Invoices, payments, receivables, purchase invoices, GST reports, Tally export |

User status: `ACTIVE | INACTIVE | SUSPENDED`. Only `ACTIVE` users can log in or use an existing token.

## 4. Modules and functional requirements

Requirement IDs (e.g. `M5.3`) are referenced from [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

### M1 — Masters & settings

| ID | Requirement |
|---|---|
| M1.1 | Business profile: legal name, trade name, address, state and state code, GSTIN, phone, email, logo, bank/UPI details for print. |
| M1.2 | Branches: name, address, branch GSTIN (if different), active flag. A user can be assigned to one or more branches; the sidebar shows the current branch. |
| M1.3 | Users and roles: create users, assign role and branches, deactivate. Role → permission matrix is editable by Owner. |
| M1.4 | Document number series per branch and financial year (April–March): invoices `INV-24-01874`, job cards `JC-24-00598`, credit notes, purchase orders, GRNs. Prefix and padding are configurable. |
| M1.5 | Tax settings: GST rates (0/5/12/18/28%), HSN/SAC master, default rate per category. |
| M1.6 | Print settings: invoice terms, footer text, signature label, A4 or 80 mm default per branch. |
| M1.7 | POS settings: allow negative stock (default off), max discount % per role, default payment mode. |

### M2 — Customers

| ID | Requirement |
|---|---|
| M2.1 | Customer types: `RETAIL`, `FLEET`, `B2B`. Walk-in counter sales can skip customer details. |
| M2.2 | Fields: name, mobile (10 digits, unique among active customers), alternate phone, email, address, city, PIN, GSTIN (validated format + state code), place of supply, credit limit, credit days. |
| M2.3 | One customer owns many vehicles; a vehicle has one current owner (ownership history kept). |
| M2.4 | Customer detail: vehicles, job cards, invoices, payments, outstanding balance, visit count. |
| M2.5 | Search by name, mobile or vehicle number from the top bar (Ctrl K) and from POS/job card. |

### M3 — Vehicles

> **Plan change (2026-11-09):** there is no separate Vehicles module or screen. The vehicle details below are captured on the job card (M7), and lookups by registration number search earlier job cards.

| ID | Requirement |
|---|---|
| M3.1 | Registration number normalized to `KL 07 CB 4412` format; unique among active vehicles. |
| M3.2 | Make/model/variant/year/fuel from a catalog (e.g. *Maruti Suzuki Swift VXi · 2019 · Petrol*); VIN and engine number optional. |
| M3.3 | Odometer history: every job card records a reading; a new reading lower than the last one shows a warning. |
| M3.4 | Service history: job cards and invoices for the vehicle. |
| M3.5 | Next service due by km and date (e.g. *53,215 km or 09 May 2027*), computed from service type rules and printed on the invoice. |

### M4 — Items & inventory

| ID | Requirement |
|---|---|
| M4.1 | Part master: name, SKU (`OF-BSH-2341`), OEM part number, barcode(s), brand, category (Filters, Brakes, Lubricants, Electricals, Ignition, Accessories…), HSN, GST %, unit, MRP, sale price, purchase price, compatible vehicle models, active flag. |
| M4.2 | Labour/service master: name, SAC (e.g. `998714`), GST %, standard rate, standard hours. |
| M4.3 | Stock per branch: on hand, reserved, available (= on hand − reserved), minimum level, reorder quantity, bin location. |
| M4.4 | Append-only stock ledger: every sale, sale cancel, return, purchase receipt, adjustment, transfer in/out and reservation change writes a row with reference document and user. |
| M4.5 | Stock adjustments with mandatory reason (damage, count correction, expiry); above a threshold needs manager approval. |
| M4.6 | Inter-branch stock transfers: dispatch → receive, with in-transit quantity. |
| M4.7 | Low stock list: available ≤ minimum level (dashboard widget *Low stock · 9 items*). |
| M4.8 | Opening stock and item master import from CSV/Excel with validation preview. |
| M4.9 | Barcode label printing for items without a manufacturer barcode. |

### M5 — POS billing

| ID | Requirement |
|---|---|
| M5.1 | Full-screen POS (own header: Exit POS, counter, cashier, shift opened time, shortcut hints). Opens with **F2** from anywhere. |
| M5.2 | Scan/search box always focused: barcode scan adds the item; typing searches name, SKU, OEM number. **F3** focuses search. |
| M5.3 | Category chips filter the product grid. Tiles show category, name, SKU, price, stock state (`n in stock`, `Only n left` in warning colour, `Out of stock` disabled) and a yellow quantity badge when the item is in the cart. |
| M5.4 | Cart: item, unit price, quantity stepper, line total, remove. Reserved stock is not counted as available. |
| M5.5 | Customer attach by mobile or vehicle number; shows name, vehicle and mobile; **Change** button. Walk-in allowed. |
| M5.6 | Discount on a line or the bill (amount or %); limit by role, above limit needs manager PIN. |
| M5.7 | Totals: subtotal and item count, discount, GST (CGST + SGST or IGST), round off, **Total payable**. |
| M5.8 | Payment modes Cash / UPI / Card / Credit, with split payment. Cash shows tendered and change. UPI shows a dynamic QR (M11). Credit requires a customer within credit limit. |
| M5.9 | **Hold (F8)** saves the cart; held carts can be resumed from a list. **Charge (F12)** posts the invoice. |
| M5.10 | After charge: toast *Invoice INV-24-01874 saved* with **Print**; auto-print if configured. |
| M5.11 | Shifts: open with opening cash; close with counted cash per mode; shift report shows expected vs. counted. |

### M6 — Invoices & payments

| ID | Requirement |
|---|---|
| M6.1 | Tax invoice per the A4 design: business header, *TAX INVOICE · Original for recipient*, bill-to, vehicle, invoice no./date/job card/place of supply, lines (#, description + SKU, HSN/SAC, qty, rate, GST %, taxable value), amount in words, payment details, next service due, tax summary, total, paid, balance due, terms, signatures, page x of y. |
| M6.2 | 80 mm thermal receipt layout for counter sales. |
| M6.3 | Statuses: `DRAFT`, `PAID`, `PARTIALLY_PAID`, `UNPAID`, `OVERDUE` (past credit days), `CANCELLED`. |
| M6.4 | Record payments against an invoice (cash/UPI/card/bank transfer/cheque) with reference; partial payments allowed. |
| M6.5 | Cancel invoice: confirm modal (*Cancel invoice INV-24-01873? Stock for 3 items will be returned to inventory.*), reason required, manager permission, stock returned, number kept. |
| M6.6 | Credit note / sales return for some lines of a posted invoice. |
| M6.7 | Row actions: View, Print, Send on WhatsApp, Cancel. |
| M6.8 | List filters: date range, status, customer, payment mode, branch; search by number, customer or vehicle. |
| M6.9 | E-invoice: for B2B invoices when enabled, generate IRN and signed QR, print them on the invoice; cancel IRN within the allowed window. |
| M6.10 | E-way bill generation for qualifying goods movements (value threshold, inter-state). |

### M7 — Job cards & workshop

> **Removed (2026-11-09):** the business doesn't provide service. Job cards, vehicles (M3) and the workshop are out of scope; the requirements below are kept for reference only.

| ID | Requirement |
|---|---|
| M7.1 | New job card starts with the registration number. Returning vehicles auto-fill make/model, customer and mobile and show *Returning customer · 6 visits*. |
| M7.2 | Capture odometer (with *Last visit: 42,870 km on 12 May*), fuel level (E, ¼, ½, ¾, F), service types (multi-select chips: Periodic service, Brakes, AC, Electrical, Suspension, Body & paint, Wheel alignment), customer complaint. |
| M7.3 | Assign technician (with open-job count), bay, promised delivery date/time. |
| M7.4 | Estimate: add labour and parts lines; summary card shows labour, parts, GST, estimate total; advance received. |
| M7.5 | Stock warning when a part on the estimate is low (*only 3 in stock — reserve them now*); reserve action. |
| M7.6 | Send estimate on WhatsApp for approval; approval/rejection is recorded on the job card. |
| M7.7 | Autosave drafts (*Autosaved 11:52 AM*); actions Cancel, Save draft, Create job card. |
| M7.8 | Status flow: `DRAFT → WAITING_FOR_BAY → IN_SERVICE → QUALITY_CHECK → READY_FOR_DELIVERY → DELIVERED`, plus `CANCELLED`. Delayed = past promised delivery and not ready. |
| M7.9 | Workshop board (*View board*): columns by status, drag to move, counts per column. |
| M7.10 | Additional work found during service is added as new estimate lines and needs fresh approval. |
| M7.11 | Convert to invoice: labour + parts used, advance applied as payment, reservations released into sale; job card links to invoice. |
| M7.12 | On delivery, set next service due and schedule a reminder. |

### M8 — Purchases & suppliers

| ID | Requirement |
|---|---|
| M8.1 | Supplier master: name, GSTIN, contact, address, payment terms, items supplied. |
| M8.2 | Purchase order: create manually or from the low-stock list (*Create purchase order*), send to supplier (PDF/WhatsApp). |
| M8.3 | Goods receipt (GRN) against a PO or direct; partial receipts; increases stock through the ledger. |
| M8.4 | Purchase invoice with input GST; matches GRN quantities and rates. |
| M8.5 | Supplier payments and payables ageing. |
| M8.6 | Purchase return (debit note) reduces stock. |

### M9 — Dashboard

| ID | Requirement |
|---|---|
| M9.1 | Header: title, date and branch; range toggle Today / 7 days / 30 days; Export. |
| M9.2 | KPI cards: *Today's sales* (amount, bill count, average, change vs. previous period), *Collected* (amount, % of sales, cash/UPI split), *Open job cards* (count, delayed count, ready for delivery), *Receivables* (amount, party count, overdue > 30 days). |
| M9.3 | *Sales, last 14 days* stacked bars: parts vs. labour; today highlighted. |
| M9.4 | *Workshop today*: counts and proportion bar for Waiting for bay, In service, Quality check, Ready for delivery. |
| M9.5 | *Recent invoices*: number, time, customer, vehicle/sub-text, amount, status badge; link to all invoices. |
| M9.6 | *Low stock*: item, SKU, available vs. minimum; *Create purchase order*. |
| M9.7 | Owner can switch between a branch and all branches. |

### M10 — Reports

| ID | Requirement |
|---|---|
| M10.1 | Sales register (by date, branch, customer, item, category, mode). |
| M10.2 | Day book and shift report. |
| M10.3 | GSTR-1 data (B2B, B2C large/small, credit notes, HSN summary) as JSON/Excel; GSTR-3B summary. |
| M10.4 | Receivables ageing (0–30, 31–60, 61–90, 90+). |
| M10.5 | Stock valuation, stock movement, slow/non-moving items. |
| M10.6 | Workshop: job cards by status, average turnaround time, technician productivity (billed labour hours). |
| M10.7 | Purchase register and payables. |
| M10.8 | Tally export (vouchers XML) for sales, purchases and payments. |

### M11 — Integrations & notifications

| ID | Requirement |
|---|---|
| M11.1 | **WhatsApp** (Business API via a BSP): estimate approval, invoice PDF, ready-for-delivery, service due reminder, payment reminder. Approved templates; delivery status logged. |
| M11.2 | **UPI / payment gateway**: dynamic UPI QR for the exact amount on Charge; webhook marks the payment received; payment links for credit invoices. |
| M11.3 | **GST e-invoice / e-way bill** via a GSP: IRN generation, cancellation, e-way bill generation; credentials per GSTIN. |
| M11.4 | **Barcode scanner**: keyboard-wedge USB scanners in the POS search box (fast-input detection + Enter). |
| M11.5 | **Thermal printer**: 80 mm receipt via browser print; optional direct ESC/POS printing via a print helper (QZ Tray). |
| M11.6 | In-app notifications (bell): low stock, delayed job cards, failed integration calls, approvals pending. |
| M11.7 | Integration failures never block billing: the invoice is saved, the failure is shown and can be retried. |

### M12 — Audit

| ID | Requirement |
|---|---|
| M12.1 | Audit log for: invoice cancel, credit notes, discount overrides, credit-limit overrides, price changes, stock adjustments, role/permission changes, settings changes, logins. |
| M12.2 | Each entry: actor, branch, action, entity, before/after values, timestamp, IP. Append-only. |

### Cross-cutting UI requirements

- App shell per design: navy sidebar grouped *Sales / Workshop / Stock / Admin*, active item in yellow, count badges (Job cards 14), user card at the bottom; top bar with global search (Ctrl K), **New bill**, notifications, user menu.
- Every data view implements loading (skeleton rows of real height), empty (icon, one-line explanation, one action), error (banner with *Try again* and *View cached data*), and no-results (*Clear filters*) states.
- Destructive actions use a confirmation modal whose title is a question and whose buttons are verbs.

## 5. Business rules

### GST and amounts

- **Place of supply.** Intra-state (customer state = branch state, or B2C at the counter) → CGST + SGST, each half the rate. Inter-state → IGST at the full rate.
- **Calculation.** Per line: taxable value = qty × rate − line discount. Tax per line per rate. Bill discount is apportioned to lines before tax. Totals are rounded to the nearest ₹1 with a visible *Round off* line.
- **Prices** are entered tax-exclusive by default; an item can be marked tax-inclusive (e.g. MRP items), in which case the taxable value is back-calculated.
- **Amount in words** in Indian numbering (Thousand, Lakh, Crore): *Indian Rupees Four Thousand Eight Hundred Fourteen Only*.
- **Money** is stored as `Decimal(12,2)` (quantities `Decimal(12,3)`), never as floats. Display in `en-IN`: `₹2,48,560`, `₹4,814.00` on documents.
- **Worked examples (must pass as tests):**
  - Invoice design: taxable ₹4,080.00 + CGST 9% ₹367.20 + SGST 9% ₹367.20 = ₹4,814.40 → round off −₹0.40 → **₹4,814.00**.
  - POS design: subtotal ₹5,475.00 (9 items) + GST 18% ₹985.50 = ₹6,460.50 → round off +₹0.50 → **₹6,461**.

### Documents

- Invoice numbers are sequential and gap-free per branch per financial year. Cancelled invoices keep their number.
- A posted invoice can't be edited. Corrections are a cancellation (same day / before GST filing, by permission) or a credit note.
- Charge is idempotent: retrying with the same client key returns the same invoice.
- B2B invoices require the customer GSTIN; e-invoice is generated when the business is e-invoice-enabled.

### Stock

- On-hand quantity always equals the sum of the stock ledger for that item and branch.
- Negative stock is blocked unless the branch setting allows it.
- Parts reserved for a job card are not sellable at the POS. Reservations are released when the job card is cancelled or converted.
- Cancelling an invoice or a credit note returns stock through new ledger rows; existing rows are never edited.

### Credit and payments

- Credit sale is allowed only for a known customer, within credit limit; overrides need manager permission and are audited.
- An invoice is `OVERDUE` when unpaid past its credit days.
- Payments are append-only; a wrong payment is reversed with a reversal entry.

### Job cards

- Status can only move along allowed transitions (see M7.8); an invalid move returns 409.
- A job card can be converted to exactly one invoice. Advance received is applied as a payment on that invoice.

## 6. Data model (proposed)

All models follow the repo conventions in `api/CLAUDE.md`: UUID primary keys, camelCase fields mapped to snake_case columns, plural snake_case tables, `Timestamptz(3)` timestamps, explicit `VarChar` lengths, soft delete via `deletedAt` for master data. Ledgers and audit tables are append-only and never soft-deleted. Every transactional table carries `branchId`.

| Area | Models |
|---|---|
| Organization | `Business`, `Branch`, `Setting`, `DocumentSequence` |
| Access | `User` (exists), `RefreshToken` (exists), `Role`, `Permission`, `RolePermission`, `UserBranch`, `Shift` |
| Customers & vehicles | `Customer`, `Vehicle`, `VehicleOwnership`, `VehicleMake`, `VehicleModel`, `OdometerReading` |
| Catalog | `Item`, `ItemBarcode`, `ItemCategory`, `Brand`, `ItemCompatibility`, `LabourService`, `HsnSac`, `TaxRate` |
| Stock | `BranchStock` (cached on hand / reserved / min level), `StockLedger`, `StockReservation`, `StockTransfer` (+ lines), `StockAdjustment` (+ lines) |
| Workshop | `JobCard`, `JobCardLine`, `JobCardServiceType`, `JobCardStatusEvent`, `Bay`, `ServiceReminder` |
| Sales | `Invoice`, `InvoiceLine`, `InvoiceTaxSummary`, `Payment`, `CreditNote` (+ lines), `HeldCart`, `EInvoice` (IRN, ack, QR, e-way bill) |
| Purchases | `Supplier`, `PurchaseOrder` (+ lines), `GoodsReceipt` (+ lines), `PurchaseInvoice` (+ lines), `SupplierPayment`, `DebitNote` |
| Platform | `OutboxEvent`, `NotificationLog`, `Notification`, `IdempotencyKey`, `AuditLog` |

## 7. API conventions

- Base path `/api/v1`; `clientid` header on every request (mandatory in production).
- Auth: `Authorization: Bearer <JWT>`, 15 min access token, rotating refresh token via `/auth/refresh`.
- Branch context: `x-branch-id` header (validated against the user's branches) or explicit `branchId` filter for owners.
- Envelopes: success `{ success: true, message?, data, meta? }`; error `{ success: false, error: { code, message, details? } }`; paginated lists add `meta: { page, limit, total, totalPages }`.
- Status codes: 400 validation, 401 unauthenticated, 403 permission/branch, 404 not found, 409 conflict (duplicate, invalid status transition, insufficient stock, sequence clash), 422 business-rule failure (credit limit). Deletes return 200 with `data: null`.
- Write endpoints that create money documents accept an `Idempotency-Key` header.

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | POS item search < 150 ms p95 with 50k items; invoice posting < 500 ms p95; dashboard < 1 s. |
| Usability | Keyboard-first POS; works at 1366×768 on counter PCs; touch-friendly workshop board on tablets; WCAG 2.1 AA contrast. |
| Locale | `Asia/Kolkata` time zone (`APP_TIMEZONE`), `en-IN` number and date formats, financial year April–March. |
| Security | bcrypt passwords, JWT secret ≥ 32 chars, permission + branch check on every route, rate limiting on auth and webhooks, webhook signature verification, secrets only in env. |
| Integrity | Posting, cancellation, GRN and conversions run in single DB transactions; uniqueness enforced by constraints, not only code. |
| Reliability | Fail-fast startup on bad env/DB; graceful shutdown; outbox retries with backoff for integrations; daily backups with tested restore. |
| Auditability | Append-only ledgers, payments and audit log. |
| Maintainability | Layered modules with DI; shared zod schemas and GST logic in `packages/shared`; typecheck, lint and tests in CI. |

## 9. Success metrics

- Average counter bill time < 30 s (measured from first scan to charge).
- 0 GST calculation mismatches across the tax test suite (including both design examples).
- 0 duplicate or skipped invoice numbers under concurrent charge tests.
- Stock variance at physical audit < 1% of items.
- ≥ 80% of job cards have a WhatsApp estimate approval recorded.
- Receivables overdue > 30 days decrease month over month after go-live.

## 10. Risks and open questions

| # | Item |
|---|---|
| R1 | **GSP for e-invoice / e-way bill** — provider not chosen (sandbox access, cost per IRN). |
| R2 | **WhatsApp BSP** — Meta Cloud API directly or a BSP (Gupshup, Interakt, etc.); template approval can take days, start early. |
| R3 | **Payment gateway** — Razorpay vs. Cashfree vs. bank UPI; MDR fees; static QR fallback. |
| R4 | **Thermal printing** — browser print may show dialogs; QZ Tray needs installation and certificate signing. |
| R5 | **Data migration** — existing software/export format for customers, vehicles, items and opening stock is unknown. |
| R6 | **Offline POS** — v1 is online-only. If branch internet is unreliable, an offline queue becomes a v2 priority. |
| R7 | **Pricing rules** — customer-specific price lists or fleet discounts? Assumed single sale price + manual discount for v1. |
| R8 | **Branch GSTINs** — branches in other states need their own GSTIN and series; confirm whether any exist. |
| R9 | **Batch/expiry tracking** for lubricants and batteries (warranty serials) — assumed out of scope for v1. |
