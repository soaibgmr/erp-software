-- Phase 1: business, branches, roles/permissions, settings, number series, customers, audit log.
-- users.role (ADMIN|USER) becomes users.role_id: existing ADMINs map to the OWNER role, everyone else to COUNTER.
-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('RETAIL', 'FLEET', 'B2B');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('INVOICE', 'JOB_CARD', 'CREDIT_NOTE', 'PURCHASE_ORDER', 'GOODS_RECEIPT');


-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "type" "customer_type" NOT NULL DEFAULT 'RETAIL',
    "name" VARCHAR(150) NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "alternate_phone" VARCHAR(10),
    "email" VARCHAR(255),
    "address" VARCHAR(300),
    "city" VARCHAR(100),
    "pincode" VARCHAR(6),
    "state_code" VARCHAR(2),
    "gstin" VARCHAR(15),
    "credit_limit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200),
    "address" VARCHAR(300),
    "city" VARCHAR(100),
    "pincode" VARCHAR(6),
    "state_code" VARCHAR(2) NOT NULL,
    "gstin" VARCHAR(15),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "website" VARCHAR(200),
    "bank_name" VARCHAR(100),
    "bank_account_no" VARCHAR(30),
    "bank_ifsc" VARCHAR(11),
    "upi_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(300),
    "city" VARCHAR(100),
    "pincode" VARCHAR(6),
    "state_code" VARCHAR(2) NOT NULL,
    "gstin" VARCHAR(15),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "group" VARCHAR(30) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("group")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "doc_type" "document_type" NOT NULL,
    "financial_year" INTEGER NOT NULL,
    "prefix" VARCHAR(6) NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "branch_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" VARCHAR(30),
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),
    "permissions" VARCHAR(40)[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branches" (
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_branches_pkey" PRIMARY KEY ("user_id","branch_id")
);

-- Users: replace the role enum with a role_id, keeping existing users.
DROP INDEX "users_role_status_idx";

ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMPTZ(3),
ADD COLUMN     "role_id" UUID;

INSERT INTO "roles" ("id", "key", "name", "description", "permissions", "is_system", "updated_at") VALUES
  (gen_random_uuid(), 'OWNER', 'Owner', 'Full access to every branch, settings and reports.', ARRAY[]::VARCHAR(40)[], true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COUNTER', 'Counter', 'Cashier: POS billing, invoices, customers and shifts.', ARRAY[]::VARCHAR(40)[], true, CURRENT_TIMESTAMP);

UPDATE "users" SET "role_id" = (SELECT "id" FROM "roles" WHERE "key" = CASE WHEN "users"."role" = 'ADMIN' THEN 'OWNER' ELSE 'COUNTER' END);

ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "user_role";

-- CreateIndex
CREATE INDEX "customers_mobile_idx" ON "customers"("mobile");

-- CreateIndex
CREATE INDEX "customers_gstin_idx" ON "customers"("gstin");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_type_idx" ON "customers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_branch_id_doc_type_financial_year_key" ON "document_sequences"("branch_id", "doc_type", "financial_year");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_branches_branch_id_idx" ON "user_branches"("branch_id");

-- CreateIndex
CREATE INDEX "users_role_id_status_idx" ON "users"("role_id", "status");

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
