-- Customers' old dues (opening balance) are stored as invoices of kind OPENING_BALANCE with their own number series (OB).
CREATE TYPE "invoice_kind" AS ENUM ('SALE', 'OPENING_BALANCE');
ALTER TABLE "invoices" ADD COLUMN "kind" "invoice_kind" NOT NULL DEFAULT 'SALE';

ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';

-- Branch managers may enter old dues (new permission dues.opening).
UPDATE "roles" SET "permissions" = array_append("permissions", 'dues.opening')
 WHERE "key" = 'BRANCH_MANAGER' AND NOT ('dues.opening' = ANY("permissions"));
