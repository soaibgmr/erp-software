-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "contact_person" VARCHAR(100),
    "mobile" VARCHAR(10),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" VARCHAR(300),
    "city" VARCHAR(100),
    "pincode" VARCHAR(6),
    "state_code" VARCHAR(2),
    "gstin" VARCHAR(15),
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_items" (
    "supplier_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "last_price" DECIMAL(12,2),
    "last_purchased_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("supplier_id","item_id")
);

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_gstin_idx" ON "suppliers"("gstin");

-- CreateIndex
CREATE INDEX "supplier_items_item_id_idx" ON "supplier_items"("item_id");

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
