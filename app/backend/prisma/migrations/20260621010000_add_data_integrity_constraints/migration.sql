ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive" CHECK ("price" > 0),
  ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stock" >= 0),
  ADD CONSTRAINT "products_reorder_nonnegative" CHECK ("reorder" >= 0);

ALTER TABLE "plans"
  ADD CONSTRAINT "plans_price_positive" CHECK ("price" > 0);

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_amount_positive" CHECK ("monto" > 0);

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("monto" > 0);

CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");
CREATE INDEX "transactions_tipo_idx" ON "transactions"("tipo");
CREATE INDEX "clients_vencimiento_idx" ON "clients"("vencimiento");
CREATE INDEX "clients_status_idx" ON "clients"("status");

ALTER TABLE "attendances" ADD COLUMN "day_key" TEXT;
UPDATE "attendances"
SET "day_key" = TO_CHAR("fecha", 'YYYY-MM-DD')
WHERE "day_key" IS NULL;
ALTER TABLE "attendances" ALTER COLUMN "day_key" SET NOT NULL;
CREATE UNIQUE INDEX "attendances_client_id_day_key_key" ON "attendances"("client_id", "day_key");
