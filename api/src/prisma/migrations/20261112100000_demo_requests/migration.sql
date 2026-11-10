-- CreateTable
CREATE TABLE "demo_requests" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100),
    "mobile" VARCHAR(10) NOT NULL,
    "email" VARCHAR(255),
    "ip" VARCHAR(64),
    "handled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_requests_created_at_idx" ON "demo_requests"("created_at");
