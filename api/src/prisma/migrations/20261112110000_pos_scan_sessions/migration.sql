-- CreateTable
CREATE TABLE "pos_scan_sessions" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "phone_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_scan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_scan_events" (
    "id" BIGSERIAL NOT NULL,
    "session_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_scan_sessions_user_id_branch_id_closed_at_idx" ON "pos_scan_sessions"("user_id", "branch_id", "closed_at");

-- CreateIndex
CREATE INDEX "pos_scan_sessions_expires_at_idx" ON "pos_scan_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "pos_scan_events_session_id_id_idx" ON "pos_scan_events"("session_id", "id");

-- AddForeignKey
ALTER TABLE "pos_scan_events" ADD CONSTRAINT "pos_scan_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_scan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
