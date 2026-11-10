-- CreateEnum
CREATE TYPE "shift_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "supply_type" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- CreateEnum
CREATE TYPE "invoice_line_kind" AS ENUM ('ITEM', 'LABOUR');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "counter" VARCHAR(30) NOT NULL,
    "status" "shift_status" NOT NULL DEFAULT 'OPEN',
    "opening_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "counted" JSONB,
    "expected" JSONB,
    "close_note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "held_carts" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(60),
    "customer_id" UUID,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "held_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "branch_id" UUID NOT NULL,
    "shift_id" UUID,
    "customer_id" UUID,
    "customer_name" VARCHAR(150),
    "customer_mobile" VARCHAR(10),
    "customer_gstin" VARCHAR(15),
    "customer_address" VARCHAR(400),
    "place_of_supply" VARCHAR(2) NOT NULL,
    "supply_type" "supply_type" NOT NULL,
    "invoice_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMPTZ(3),
    "status" "invoice_status" NOT NULL,
    "gross_total" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL,
    "bill_discount_type" VARCHAR(10),
    "bill_discount_value" DECIMAL(12,2),
    "taxable_total" DECIMAL(12,2) NOT NULL,
    "cgst_total" DECIMAL(12,2) NOT NULL,
    "sgst_total" DECIMAL(12,2) NOT NULL,
    "igst_total" DECIMAL(12,2) NOT NULL,
    "round_off" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "paid_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credited_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(300),
    "discount_approved_by_id" UUID,
    "credit_approved_by_id" UUID,
    "created_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancel_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "kind" "invoice_line_kind" NOT NULL,
    "item_id" UUID,
    "labour_service_id" UUID,
    "description" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(40),
    "hsn_sac" VARCHAR(8),
    "unit" VARCHAR(10) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "line_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bill_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxable" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2),
    "returned_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "shift_id" UUID,
    "mode" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "tendered" DECIMAL(12,2),
    "reference" VARCHAR(60),
    "note" VARCHAR(200),
    "kind" VARCHAR(10),
    "reverses_payment_id" UUID,
    "credit_note_id" UUID,
    "created_by_id" UUID,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "branch_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "taxable_total" DECIMAL(12,2) NOT NULL,
    "cgst_total" DECIMAL(12,2) NOT NULL,
    "sgst_total" DECIMAL(12,2) NOT NULL,
    "igst_total" DECIMAL(12,2) NOT NULL,
    "round_off" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "refunded" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "invoice_line_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "taxable" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "user_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(30) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_branch_id_user_id_status_idx" ON "shifts"("branch_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "shifts_opened_at_idx" ON "shifts"("opened_at");

-- CreateIndex
CREATE INDEX "held_carts_branch_id_deleted_at_idx" ON "held_carts"("branch_id", "deleted_at");

-- CreateIndex
CREATE INDEX "invoices_branch_id_invoice_date_idx" ON "invoices"("branch_id", "invoice_date");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_shift_id_idx" ON "invoices"("shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_branch_id_number_key" ON "invoices"("branch_id", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_item_id_idx" ON "invoice_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reverses_payment_id_key" ON "payments"("reverses_payment_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_shift_id_idx" ON "payments"("shift_id");

-- CreateIndex
CREATE INDEX "payments_branch_id_received_at_idx" ON "payments"("branch_id", "received_at");

-- CreateIndex
CREATE INDEX "credit_notes_invoice_id_idx" ON "credit_notes"("invoice_id");

-- CreateIndex
CREATE INDEX "credit_notes_branch_id_created_at_idx" ON "credit_notes"("branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_branch_id_number_key" ON "credit_notes"("branch_id", "number");

-- CreateIndex
CREATE INDEX "credit_note_lines_credit_note_id_idx" ON "credit_note_lines"("credit_note_id");

-- CreateIndex
CREATE INDEX "credit_note_lines_invoice_line_id_idx" ON "credit_note_lines"("invoice_line_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Branch managers may allow credit beyond a customer's limit (new permission credit.override).
UPDATE "roles" SET "permissions" = array_append("permissions", 'credit.override')
 WHERE "key" = 'BRANCH_MANAGER' AND NOT ('credit.override' = ANY("permissions"));
