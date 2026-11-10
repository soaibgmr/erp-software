-- Trigram indexes on items power the POS part search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "hsn_sac_kind" AS ENUM ('HSN', 'SAC');

-- CreateEnum
CREATE TYPE "item_unit" AS ENUM ('PCS', 'SET', 'PAIR', 'KIT', 'LTR', 'ML', 'KG', 'GM', 'MTR', 'ROLL', 'BOX');

-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('OPENING', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER_CANCEL', 'SALE', 'SALE_CANCEL', 'SALE_RETURN', 'PURCHASE', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "stock_adjustment_reason" AS ENUM ('COUNT_CORRECTION', 'DAMAGE', 'EXPIRY', 'OPENING_STOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "stock_adjustment_status" AS ENUM ('PENDING', 'POSTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "stock_transfer_status" AS ENUM ('IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "document_type" ADD VALUE 'STOCK_ADJUSTMENT';
ALTER TYPE "document_type" ADD VALUE 'STOCK_TRANSFER';

-- CreateTable
CREATE TABLE "item_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hsn_sac_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "kind" "hsn_sac_kind" NOT NULL DEFAULT 'HSN',
    "description" VARCHAR(300) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "hsn_sac_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_makes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "vehicle_makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" UUID NOT NULL,
    "make_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "oem_part_no" VARCHAR(60),
    "description" VARCHAR(500),
    "category_id" UUID,
    "brand_id" UUID,
    "hsn_code" VARCHAR(8),
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "unit" "item_unit" NOT NULL DEFAULT 'PCS',
    "mrp" DECIMAL(12,2),
    "sale_price" DECIMAL(12,2) NOT NULL,
    "purchase_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_barcodes" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_compatibility" (
    "item_id" UUID NOT NULL,
    "vehicle_model_id" UUID NOT NULL,

    CONSTRAINT "item_compatibility_pkey" PRIMARY KEY ("item_id","vehicle_model_id")
);

-- CreateTable
CREATE TABLE "labour_services" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20),
    "name" VARCHAR(150) NOT NULL,
    "sac_code" VARCHAR(8) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "standard_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "labour_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_stock" (
    "branch_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "on_hand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "in_transit" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "min_level" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorder_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "bin_location" VARCHAR(30),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_stock_pkey" PRIMARY KEY ("branch_id","item_id")
);

-- CreateTable
CREATE TABLE "stock_ledger" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "balance_after" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2),
    "ref_type" VARCHAR(30),
    "ref_id" UUID,
    "ref_no" VARCHAR(30),
    "note" VARCHAR(300),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "branch_id" UUID NOT NULL,
    "reason" "stock_adjustment_reason" NOT NULL,
    "note" VARCHAR(300),
    "status" "stock_adjustment_status" NOT NULL,
    "total_value" DECIMAL(12,2) NOT NULL,
    "created_by_id" UUID,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_lines" (
    "id" UUID NOT NULL,
    "adjustment_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "from_branch_id" UUID NOT NULL,
    "to_branch_id" UUID NOT NULL,
    "status" "stock_transfer_status" NOT NULL DEFAULT 'IN_TRANSIT',
    "note" VARCHAR(300),
    "created_by_id" UUID,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_categories_name_idx" ON "item_categories"("name");

-- CreateIndex
CREATE INDEX "brands_name_idx" ON "brands"("name");

-- CreateIndex
CREATE INDEX "hsn_sac_codes_code_idx" ON "hsn_sac_codes"("code");

-- CreateIndex
CREATE INDEX "vehicle_makes_name_idx" ON "vehicle_makes"("name");

-- CreateIndex
CREATE INDEX "vehicle_models_make_id_idx" ON "vehicle_models"("make_id");

-- CreateIndex
CREATE INDEX "items_sku_idx" ON "items"("sku");

-- CreateIndex
CREATE INDEX "items_oem_part_no_idx" ON "items"("oem_part_no");

-- CreateIndex
CREATE INDEX "items_category_id_idx" ON "items"("category_id");

-- CreateIndex
CREATE INDEX "items_brand_id_idx" ON "items"("brand_id");

-- CreateIndex
CREATE INDEX "items_name_trgm_idx" ON "items" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "items_sku_trgm_idx" ON "items" USING GIN ("sku" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "items_oem_part_no_trgm_idx" ON "items" USING GIN ("oem_part_no" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "item_barcodes_code_idx" ON "item_barcodes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "item_barcodes_item_id_code_key" ON "item_barcodes"("item_id", "code");

-- CreateIndex
CREATE INDEX "item_compatibility_vehicle_model_id_idx" ON "item_compatibility"("vehicle_model_id");

-- CreateIndex
CREATE INDEX "labour_services_name_idx" ON "labour_services"("name");

-- CreateIndex
CREATE INDEX "branch_stock_item_id_idx" ON "branch_stock"("item_id");

-- CreateIndex
CREATE INDEX "stock_ledger_branch_id_item_id_created_at_idx" ON "stock_ledger"("branch_id", "item_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_ledger_item_id_idx" ON "stock_ledger"("item_id");

-- CreateIndex
CREATE INDEX "stock_ledger_ref_type_ref_id_idx" ON "stock_ledger"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_branch_id_status_idx" ON "stock_adjustments"("branch_id", "status");

-- CreateIndex
CREATE INDEX "stock_adjustments_created_at_idx" ON "stock_adjustments"("created_at");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_adjustment_id_idx" ON "stock_adjustment_lines"("adjustment_id");

-- CreateIndex
CREATE INDEX "stock_transfers_from_branch_id_status_idx" ON "stock_transfers"("from_branch_id", "status");

-- CreateIndex
CREATE INDEX "stock_transfers_to_branch_id_status_idx" ON "stock_transfers"("to_branch_id", "status");

-- CreateIndex
CREATE INDEX "stock_transfers_created_at_idx" ON "stock_transfers"("created_at");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_transfer_id_idx" ON "stock_transfer_lines"("transfer_id");

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_compatibility" ADD CONSTRAINT "item_compatibility_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_compatibility" ADD CONSTRAINT "item_compatibility_vehicle_model_id_fkey" FOREIGN KEY ("vehicle_model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_stock" ADD CONSTRAINT "branch_stock_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Branch managers approve stock adjustments above the limit (new permission stock.approve).
UPDATE "roles" SET "permissions" = array_append("permissions", 'stock.approve')
 WHERE "key" = 'BRANCH_MANAGER' AND NOT ('stock.approve' = ANY("permissions"));
