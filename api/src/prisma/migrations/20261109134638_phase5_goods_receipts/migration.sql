-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "reference" VARCHAR(40),
    "note" VARCHAR(300),
    "total_value" DECIMAL(12,2) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "purchase_order_line_id" UUID,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "hsn_code" VARCHAR(8),
    "unit" "item_unit" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "invoiced_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "returned_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goods_receipts_branch_id_created_at_idx" ON "goods_receipts"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_branch_id_number_key" ON "goods_receipts"("branch_id", "number");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_goods_receipt_id_idx" ON "goods_receipt_lines"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_item_id_idx" ON "goods_receipt_lines"("item_id");

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
