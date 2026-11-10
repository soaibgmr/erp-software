-- CreateEnum
CREATE TYPE "business_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "auth_token_purpose" AS ENUM ('RESET_PASSWORD', 'VERIFY_EMAIL');

-- DropIndex
DROP INDEX "branches_code_key";

-- DropIndex
DROP INDEX "roles_key_key";

-- DropIndex
DROP INDEX "roles_name_key";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "status" "business_status" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "status_note" VARCHAR(300);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "hsn_sac_codes" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "item_barcodes" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "item_categories" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "labour_services" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN "business_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "business_id" UUID,
ADD COLUMN     "email_verified_at" TIMESTAMPTZ(3),
ADD COLUMN     "mobile" VARCHAR(10),
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "vehicle_makes" ADD COLUMN     "business_id" UUID;

-- AlterTable
ALTER TABLE "vehicle_models" ADD COLUMN     "business_id" UUID;

-- Backfill: everything that exists today belongs to the one existing business, which stays ACTIVE.
DO $$
DECLARE biz UUID;
BEGIN
  SELECT id INTO biz FROM "businesses" ORDER BY "created_at" LIMIT 1;
  IF biz IS NULL THEN
    -- Fresh database: earlier migrations created empty system roles with no users; the seed creates roles per business.
    DELETE FROM "roles" r WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."role_id" = r."id");
    IF EXISTS (SELECT 1 FROM "branches") OR EXISTS (SELECT 1 FROM "users") OR EXISTS (SELECT 1 FROM "roles")
       OR EXISTS (SELECT 1 FROM "items") OR EXISTS (SELECT 1 FROM "customers") OR EXISTS (SELECT 1 FROM "settings")
       OR EXISTS (SELECT 1 FROM "item_categories") OR EXISTS (SELECT 1 FROM "brands") OR EXISTS (SELECT 1 FROM "hsn_sac_codes")
       OR EXISTS (SELECT 1 FROM "vehicle_makes") OR EXISTS (SELECT 1 FROM "labour_services") THEN
      INSERT INTO "businesses" ("id", "legal_name", "state_code", "updated_at")
      VALUES (gen_random_uuid(), 'My Business', COALESCE((SELECT "state_code" FROM "branches" ORDER BY "created_at" LIMIT 1), '32'), now())
      RETURNING id INTO biz;
    END IF;
  END IF;
  UPDATE "businesses" SET "status" = 'ACTIVE', "approved_at" = now();
  IF biz IS NOT NULL THEN
    UPDATE "branches" SET "business_id" = biz;
    UPDATE "brands" SET "business_id" = biz;
    UPDATE "customers" SET "business_id" = biz;
    UPDATE "hsn_sac_codes" SET "business_id" = biz;
    UPDATE "item_barcodes" SET "business_id" = biz;
    UPDATE "item_categories" SET "business_id" = biz;
    UPDATE "items" SET "business_id" = biz;
    UPDATE "labour_services" SET "business_id" = biz;
    UPDATE "roles" SET "business_id" = biz;
    UPDATE "users" SET "business_id" = biz;
    UPDATE "vehicle_makes" SET "business_id" = biz;
    UPDATE "vehicle_models" SET "business_id" = biz;
    UPDATE "settings" SET "business_id" = biz;
    UPDATE "audit_logs" SET "business_id" = biz;
    UPDATE "outbox_events" SET "business_id" = biz;
  END IF;
END $$;

-- Mobile login: copy a valid, unambiguous 10-digit Indian mobile from the old phone column.
UPDATE "users" u SET "mobile" = m.mobile
FROM (
  SELECT id, right(regexp_replace(coalesce("phone", ''), '\D', '', 'g'), 10) AS mobile,
         count(*) OVER (PARTITION BY right(regexp_replace(coalesce("phone", ''), '\D', '', 'g'), 10)) AS n
  FROM "users"
) m
WHERE u.id = m.id AND m.n = 1 AND m.mobile ~ '^[6-9][0-9]{9}$';

-- Existing accounts were created inside the shop, so their emails count as verified.
UPDATE "users" SET "email_verified_at" = now() WHERE "email" IS NOT NULL;

ALTER TABLE "branches" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "brands" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "hsn_sac_codes" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "item_barcodes" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "item_categories" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "items" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "labour_services" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "roles" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "vehicle_makes" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "vehicle_models" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "settings" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey", ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("business_id", "group");

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "auth_token_purpose" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE INDEX "audit_logs_business_id_idx" ON "audit_logs"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_business_id_code_key" ON "branches"("business_id", "code");

-- CreateIndex
CREATE INDEX "brands_business_id_idx" ON "brands"("business_id");

-- CreateIndex
CREATE INDEX "businesses_status_idx" ON "businesses"("status");

-- CreateIndex
CREATE INDEX "customers_business_id_idx" ON "customers"("business_id");

-- CreateIndex
CREATE INDEX "hsn_sac_codes_business_id_idx" ON "hsn_sac_codes"("business_id");

-- CreateIndex
CREATE INDEX "item_barcodes_business_id_idx" ON "item_barcodes"("business_id");

-- CreateIndex
CREATE INDEX "item_categories_business_id_idx" ON "item_categories"("business_id");

-- CreateIndex
CREATE INDEX "items_business_id_idx" ON "items"("business_id");

-- CreateIndex
CREATE INDEX "labour_services_business_id_idx" ON "labour_services"("business_id");

-- CreateIndex
CREATE INDEX "outbox_events_business_id_idx" ON "outbox_events"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_business_id_key_key" ON "roles"("business_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_business_id_name_key" ON "roles"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_business_id_idx" ON "users"("business_id");

-- CreateIndex
CREATE INDEX "vehicle_makes_business_id_idx" ON "vehicle_makes"("business_id");

-- CreateIndex
CREATE INDEX "vehicle_models_business_id_idx" ON "vehicle_models"("business_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hsn_sac_codes" ADD CONSTRAINT "hsn_sac_codes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_makes" ADD CONSTRAINT "vehicle_makes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labour_services" ADD CONSTRAINT "labour_services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

