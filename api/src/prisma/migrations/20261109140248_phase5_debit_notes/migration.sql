-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'DEBIT_NOTE';

-- AlterTable
ALTER TABLE "purchase_invoice_lines" ADD COLUMN     "returned_qty" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "debit_notes" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchase_invoice_id" UUID,
    "reason" VARCHAR(200) NOT NULL,
    "supply_type" "supply_type" NOT NULL,
    "taxable_total" DECIMAL(12,2) NOT NULL,
    "cgst_total" DECIMAL(12,2) NOT NULL,
    "sgst_total" DECIMAL(12,2) NOT NULL,
    "igst_total" DECIMAL(12,2) NOT NULL,
    "round_off" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_lines" (
    "id" UUID NOT NULL,
    "debit_note_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "goods_receipt_line_id" UUID NOT NULL,
    "purchase_invoice_line_id" UUID,
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

    CONSTRAINT "debit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debit_notes_branch_id_created_at_idx" ON "debit_notes"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "debit_notes_supplier_id_idx" ON "debit_notes"("supplier_id");

-- CreateIndex
CREATE INDEX "debit_notes_purchase_invoice_id_idx" ON "debit_notes"("purchase_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_branch_id_number_key" ON "debit_notes"("branch_id", "number");

-- CreateIndex
CREATE INDEX "debit_note_lines_debit_note_id_idx" ON "debit_note_lines"("debit_note_id");

-- CreateIndex
CREATE INDEX "debit_note_lines_goods_receipt_line_id_idx" ON "debit_note_lines"("goods_receipt_line_id");

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
