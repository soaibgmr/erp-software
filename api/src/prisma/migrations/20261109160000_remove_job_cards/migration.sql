-- Job cards (and the workshop) are out of scope: the business sells parts and doesn't provide service.

-- 1. Drop the JOB_CARD document type (no job card was ever numbered).
DELETE FROM "document_sequences" WHERE "doc_type" = 'JOB_CARD';
ALTER TYPE "document_type" RENAME TO "document_type_old";
CREATE TYPE "document_type" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER');
ALTER TABLE "document_sequences" ALTER COLUMN "doc_type" TYPE "document_type" USING ("doc_type"::text::"document_type");
DROP TYPE "document_type_old";

-- 2. Remove the job card permissions from every role.
UPDATE "roles"
   SET "permissions" = ARRAY(SELECT p FROM unnest("permissions") AS p WHERE p NOT LIKE 'jobcard.%')::varchar(40)[]
 WHERE EXISTS (SELECT 1 FROM unnest("permissions") AS p WHERE p LIKE 'jobcard.%');

-- 3. Retire the Service advisor and Technician system roles: soft-delete them when nobody uses them,
--    otherwise keep them as ordinary (editable) roles so their users can still sign in.
UPDATE "roles" r
   SET "deleted_at" = now(), "key" = NULL, "is_system" = false
 WHERE r."key" IN ('SERVICE_ADVISOR', 'TECHNICIAN')
   AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."role_id" = r."id" AND u."deleted_at" IS NULL);
UPDATE "roles" SET "key" = NULL, "is_system" = false WHERE "key" IN ('SERVICE_ADVISOR', 'TECHNICIAN');
