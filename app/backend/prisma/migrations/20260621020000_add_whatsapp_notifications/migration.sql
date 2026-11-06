CREATE TYPE "NotificationKind" AS ENUM ('WELCOME', 'EXPIRY_REMINDER', 'EXPIRED', 'RENEWAL');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE "clients"
  ADD COLUMN "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "dedupe_key" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "reference_date" TIMESTAMP(3),
    "days_before" INTEGER,
    "provider_id" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");
CREATE INDEX "notifications_client_id_idx" ON "notifications"("client_id");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
