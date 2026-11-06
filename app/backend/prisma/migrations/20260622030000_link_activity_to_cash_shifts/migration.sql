ALTER TABLE "transactions"
  ADD COLUMN "cash_shift_id" TEXT;

ALTER TABLE "attendances"
  ADD COLUMN "cash_shift_id" TEXT;

CREATE INDEX "transactions_cash_shift_id_idx"
  ON "transactions"("cash_shift_id");

CREATE INDEX "attendances_cash_shift_id_idx"
  ON "attendances"("cash_shift_id");

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_cash_shift_id_fkey"
  FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_cash_shift_id_fkey"
  FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
