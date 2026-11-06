ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'entrenador';

CREATE TYPE "WorkoutLevel" AS ENUM ('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO');

CREATE TYPE "WorkoutAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');

CREATE TABLE "workout_routines" (
  "id" TEXT NOT NULL,
  "trainer_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "level" "WorkoutLevel" NOT NULL,
  "objective" TEXT NOT NULL,
  "duration_weeks" INTEGER NOT NULL DEFAULT 4,
  "days_per_week" INTEGER NOT NULL DEFAULT 3,
  "session_time_minutes" INTEGER,
  "notes" TEXT,
  "days" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workout_routines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_assignments" (
  "id" TEXT NOT NULL,
  "routine_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "trainer_id" INTEGER NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3),
  "status" "WorkoutAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "client_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workout_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workout_routines_trainer_id_idx" ON "workout_routines"("trainer_id");
CREATE INDEX "workout_routines_level_idx" ON "workout_routines"("level");
CREATE INDEX "workout_routines_is_active_idx" ON "workout_routines"("is_active");

CREATE INDEX "workout_assignments_routine_id_idx" ON "workout_assignments"("routine_id");
CREATE INDEX "workout_assignments_client_id_idx" ON "workout_assignments"("client_id");
CREATE INDEX "workout_assignments_trainer_id_idx" ON "workout_assignments"("trainer_id");
CREATE INDEX "workout_assignments_status_idx" ON "workout_assignments"("status");

ALTER TABLE "workout_routines"
  ADD CONSTRAINT "workout_routines_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workout_assignments"
  ADD CONSTRAINT "workout_assignments_routine_id_fkey"
  FOREIGN KEY ("routine_id") REFERENCES "workout_routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workout_assignments"
  ADD CONSTRAINT "workout_assignments_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workout_assignments"
  ADD CONSTRAINT "workout_assignments_trainer_id_fkey"
  FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
