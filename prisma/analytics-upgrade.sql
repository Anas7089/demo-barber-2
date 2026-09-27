-- Upgrade helper for databases created from Stage 1 before analytics fields existed.
-- For a brand new install, prefer the checked-in Prisma migrations.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ(3);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "costCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "commissionBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "barberCommissionBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingService" ADD COLUMN IF NOT EXISTS "costCents" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM ('RENT','UTILITIES','SUPPLIES','MARKETING','SOFTWARE','PAYROLL','TAX','INSURANCE','MAINTENANCE','OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "OperatingExpense" (
  "id" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "incurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OperatingExpense_incurredAt_idx" ON "OperatingExpense"("incurredAt");
CREATE INDEX IF NOT EXISTS "OperatingExpense_category_incurredAt_idx" ON "OperatingExpense"("category", "incurredAt");
