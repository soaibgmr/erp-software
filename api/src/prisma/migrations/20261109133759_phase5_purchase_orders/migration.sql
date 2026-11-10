-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "supply_type" "supply_type" NOT NULL,
    "expected_date" DATE,
    "note" VARCHAR(300),
    "taxable_total" DECIMAL(12,2) NOT NULL,
    "tax_total" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "created_by_id" UUID,
    "sent_at" TIMESTAMPTZ(3),
    "sent_by_id" UUID,
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,
    "close_reason" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "hsn_code" VARCHAR(8),
    "unit" "item_unit" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "received_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "taxable_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_orders_branch_id_status_idx" ON "purchase_orders"("branch_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_branch_id_number_key" ON "purchase_orders"("branch_id", "number");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_item_id_idx" ON "purchase_order_lines"("item_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
