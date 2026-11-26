-- One SKU, one barcode and one customer mobile number per shop, enforced by the
-- database so two people saving at the same moment can't create duplicates
-- (the services also check first, to give a friendly message).
-- Partial/expression indexes can't be written in schema.prisma; if `prisma migrate dev`
-- ever proposes dropping these three indexes, delete those lines from the new migration.
--
-- Before deploying, check for existing duplicates (each query must return no rows):
--   SELECT business_id, lower(sku), count(*) FROM items WHERE deleted_at IS NULL GROUP BY 1, 2 HAVING count(*) > 1;
--   SELECT b.business_id, b.code, count(*) FROM item_barcodes b JOIN items i ON i.id = b.item_id
--     WHERE i.deleted_at IS NULL GROUP BY 1, 2 HAVING count(*) > 1;
--   SELECT business_id, mobile, count(*) FROM customers WHERE deleted_at IS NULL GROUP BY 1, 2 HAVING count(*) > 1;

-- Barcodes of deleted items are never looked up; remove them so the code can be reused.
-- (Deleting an item now removes its barcodes as well.)
DELETE FROM "item_barcodes" b USING "items" i WHERE b."item_id" = i."id" AND i."deleted_at" IS NOT NULL;

CREATE UNIQUE INDEX "items_business_id_sku_active_key"
  ON "items" ("business_id", lower("sku")) WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "item_barcodes_business_id_code_key"
  ON "item_barcodes" ("business_id", "code");

CREATE UNIQUE INDEX "customers_business_id_mobile_active_key"
  ON "customers" ("business_id", "mobile") WHERE "deleted_at" IS NULL;
