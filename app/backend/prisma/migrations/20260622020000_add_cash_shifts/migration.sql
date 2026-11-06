CREATE TYPE "CashShiftType" AS ENUM ('MORNING', 'EVENING');
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "cash_shifts" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "shift_type" "CashShiftType" NOT NULL,
    "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
    "day_key" TEXT NOT NULL,
    "opening_cash" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expected_cash" DECIMAL(10,2),
    "declared_cash" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opening_notes" TEXT,
    "closing_notes" TEXT,
    "report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_shifts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_shifts_opening_cash_nonnegative" CHECK ("opening_cash" >= 0),
    CONSTRAINT "cash_shifts_declared_cash_nonnegative" CHECK ("declared_cash" IS NULL OR "declared_cash" >= 0)
);

CREATE INDEX "cash_shifts_user_id_idx" ON "cash_shifts"("user_id");
CREATE INDEX "cash_shifts_day_key_idx" ON "cash_shifts"("day_key");
CREATE INDEX "cash_shifts_status_idx" ON "cash_shifts"("status");
CREATE INDEX "cash_shifts_opened_at_idx" ON "cash_shifts"("opened_at");

-- Solo puede existir un turno abierto por usuario.
CREATE UNIQUE INDEX "cash_shifts_one_open_per_user"
ON "cash_shifts"("user_id")
WHERE "status" = 'OPEN';

ALTER TABLE "cash_shifts"
  ADD CONSTRAINT "cash_shifts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_shifts" ENABLE ROW LEVEL SECURITY;
