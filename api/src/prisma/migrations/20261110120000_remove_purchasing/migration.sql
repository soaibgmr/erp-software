-- Purchasing is removed: suppliers, purchase orders, goods receipts, supplier bills and payments,
-- debit notes (purchase returns) and the order list. A data backup was taken before this ran
-- (backups/purchasing-before-removal-2026-11-10.sql). Stock ledger rows of type PURCHASE /
-- PURCHASE_RETURN stay as history, so on-hand quantities don't change.

-- Number series of the removed documents.
DELETE FROM "document_sequences" WHERE "doc_type"::text IN ('PURCHASE_ORDER', 'GOODS_RECEIPT', 'DEBIT_NOTE');

-- Permissions of the removed screens.
UPDATE "roles"
   SET "permissions" = array_remove(array_remove(array_remove(array_remove("permissions",
       'purchase.view'), 'purchase.manage'), 'supplier.view'), 'supplier.manage')
 WHERE "permissions" && ARRAY['purchase.view', 'purchase.manage', 'supplier.view', 'supplier.manage']::varchar[];

UPDATE "roles" SET "description" = 'Items, stock adjustments and transfers.' WHERE "key" = 'STOCK_KEEPER' OR "key" = 'STOREKEEPER';

-- AlterEnum
BEGIN;
CREATE TYPE "document_type_new" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER', 'OPENING_BALANCE');
ALTER TABLE "document_sequences" ALTER COLUMN "doc_type" TYPE "document_type_new" USING ("doc_type"::text::"document_type_new");
ALTER TYPE "document_type" RENAME TO "document_type_old";
ALTER TYPE "document_type_new" RENAME TO "document_type";
DROP TYPE "public"."document_type_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "debit_note_lines" DROP CONSTRAINT "debit_note_lines_debit_note_id_fkey";

-- DropForeignKey
ALTER TABLE "debit_notes" DROP CONSTRAINT "debit_notes_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "debit_notes" DROP CONSTRAINT "debit_notes_purchase_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "debit_notes" DROP CONSTRAINT "debit_notes_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipt_lines" DROP CONSTRAINT "goods_receipt_lines_goods_receipt_id_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipt_lines" DROP CONSTRAINT "goods_receipt_lines_item_id_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "order_list_items" DROP CONSTRAINT "order_list_items_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "order_list_items" DROP CONSTRAINT "order_list_items_item_id_fkey";

-- DropForeignKey
ALTER TABLE "order_list_items" DROP CONSTRAINT "order_list_items_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_invoice_lines" DROP CONSTRAINT "purchase_invoice_lines_goods_receipt_line_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_invoice_lines" DROP CONSTRAINT "purchase_invoice_lines_purchase_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_lines" DROP CONSTRAINT "purchase_order_lines_item_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_lines" DROP CONSTRAINT "purchase_order_lines_purchase_order_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "supplier_items" DROP CONSTRAINT "supplier_items_item_id_fkey";

-- DropForeignKey
ALTER TABLE "supplier_items" DROP CONSTRAINT "supplier_items_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "supplier_payments" DROP CONSTRAINT "supplier_payments_purchase_invoice_id_fkey";

-- DropTable
DROP TABLE "debit_note_lines";

-- DropTable
DROP TABLE "debit_notes";

-- DropTable
DROP TABLE "goods_receipt_lines";

-- DropTable
DROP TABLE "goods_receipts";

-- DropTable
DROP TABLE "order_list_items";

-- DropTable
DROP TABLE "purchase_invoice_lines";

-- DropTable
DROP TABLE "purchase_invoices";

-- DropTable
DROP TABLE "purchase_order_lines";

-- DropTable
DROP TABLE "purchase_orders";

-- DropTable
DROP TABLE "supplier_items";

-- DropTable
DROP TABLE "supplier_payments";

-- DropTable
DROP TABLE "suppliers";

-- DropEnum
DROP TYPE "order_list_source";

-- DropEnum
DROP TYPE "purchase_invoice_status";

-- DropEnum
DROP TYPE "purchase_order_status";

