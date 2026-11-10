-- CreateEnum
CREATE TYPE "purchase_invoice_status" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_invoice_no" VARCHAR(40) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "supplier_gstin" VARCHAR(15),
    "supply_type" "supply_type" NOT NULL,
    "status" "purchase_invoice_status" NOT NULL,
    "taxable_total" DECIMAL(12,2) NOT NULL,
    "cgst_total" DECIMAL(12,2) NOT NULL,
    "sgst_total" DECIMAL(12,2) NOT NULL,
    "igst_total" DECIMAL(12,2) NOT NULL,
    "round_off" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "paid_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "debited_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" VARCHAR(300),
    "created_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancel_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" UUID NOT NULL,
    "purchase_invoice_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "goods_receipt_line_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "hsn_code" VARCHAR(8),
    "unit" "item_unit" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "taxable_amount" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "purchase_invoice_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_on" DATE NOT NULL,
    "reference" VARCHAR(60),
    "note" VARCHAR(200),
    "kind" VARCHAR(10),
    "reverses_payment_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_invoices_branch_id_invoice_date_idx" ON "purchase_invoices"("branch_id", "invoice_date");

-- CreateIndex
CREATE INDEX "purchase_invoices_branch_id_status_due_date_idx" ON "purchase_invoices"("branch_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplier_id_supplier_invoice_no_idx" ON "purchase_invoices"("supplier_id", "supplier_invoice_no");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_purchase_invoice_id_idx" ON "purchase_invoice_lines"("purchase_invoice_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_goods_receipt_line_id_idx" ON "purchase_invoice_lines"("goods_receipt_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_reverses_payment_id_key" ON "supplier_payments"("reverses_payment_id");

-- CreateIndex
CREATE INDEX "supplier_payments_purchase_invoice_id_idx" ON "supplier_payments"("purchase_invoice_id");

-- CreateIndex
CREATE INDEX "supplier_payments_branch_id_paid_on_idx" ON "supplier_payments"("branch_id", "paid_on");

-- CreateIndex
CREATE INDEX "supplier_payments_supplier_id_idx" ON "supplier_payments"("supplier_id");

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
