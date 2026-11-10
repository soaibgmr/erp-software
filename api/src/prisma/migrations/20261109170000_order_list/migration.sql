-- remove_job_cards (20261109160000) recreates document_type without DEBIT_NOTE when migrations replay in order
-- on a fresh database; restore it here. No-op where phase5_debit_notes already added it.
ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'DEBIT_NOTE';

-- CreateEnum
CREATE TYPE "order_list_source" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "order_list_items" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "supplier_id" UUID,
    "note" VARCHAR(200),
    "source" "order_list_source" NOT NULL,
    "added_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_list_items_branch_id_created_at_idx" ON "order_list_items"("branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_list_items_branch_id_item_id_key" ON "order_list_items"("branch_id", "item_id");

-- AddForeignKey
ALTER TABLE "order_list_items" ADD CONSTRAINT "order_list_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_list_items" ADD CONSTRAINT "order_list_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_list_items" ADD CONSTRAINT "order_list_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: items already out of stock (available = on hand − reserved ≤ 0) and not on an open purchase order.
INSERT INTO "order_list_items" ("id", "branch_id", "item_id", "quantity", "source", "created_at", "updated_at")
SELECT gen_random_uuid(), bs.branch_id, bs.item_id,
       GREATEST(bs.reorder_qty, bs.min_level - (bs.on_hand - bs.reserved), 1), 'AUTO', now(), now()
  FROM "branch_stock" bs
  JOIN "items" i ON i.id = bs.item_id AND i.deleted_at IS NULL AND i.is_active
 WHERE bs.on_hand - bs.reserved <= 0
   AND NOT EXISTS (
     SELECT 1 FROM "purchase_order_lines" l JOIN "purchase_orders" o ON o.id = l.purchase_order_id
      WHERE o.branch_id = bs.branch_id AND l.item_id = bs.item_id
        AND o.status IN ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED') AND l.quantity > l.received_qty)
ON CONFLICT ("branch_id", "item_id") DO NOTHING;
