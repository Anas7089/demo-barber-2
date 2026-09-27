-- Prisma does not currently express PostgreSQL exclusion constraints directly.
-- Run after the initial Prisma migration. These checks protect booking and
-- analytics invariants even when concurrent requests bypass application code.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_no_live_overlap'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_no_live_overlap"
      EXCLUDE USING gist (
        "barberId" WITH =,
        tstzrange("startAt", "blockedUntilAt", '[)') WITH &&
      )
      WHERE ("status" IN ('PENDING', 'CONFIRMED'));
  END IF;
END
$$;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_positive_duration";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_positive_duration"
  CHECK ("endAt" > "startAt" AND "blockedUntilAt" >= "endAt" AND "totalDurationMinutes" > 0 AND "totalPriceCents" >= 0 AND "barberCommissionBps" BETWEEN 0 AND 10000);

ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_positive_values";
ALTER TABLE "Service" ADD CONSTRAINT "Service_positive_values"
  CHECK ("durationMinutes" > 0 AND "priceCents" >= 0 AND "costCents" >= 0);

ALTER TABLE "Barber" DROP CONSTRAINT IF EXISTS "Barber_commission_range";
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_commission_range"
  CHECK ("commissionBps" BETWEEN 0 AND 10000);

ALTER TABLE "BookingService" DROP CONSTRAINT IF EXISTS "BookingService_positive_values";
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_positive_values"
  CHECK ("durationMinutes" > 0 AND "priceCents" >= 0 AND "costCents" >= 0);

ALTER TABLE "OperatingExpense" DROP CONSTRAINT IF EXISTS "OperatingExpense_positive_amount";
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_positive_amount"
  CHECK ("amountCents" > 0);
