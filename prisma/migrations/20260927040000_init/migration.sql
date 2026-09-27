-- Full production baseline for fresh PostgreSQL databases.
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BARBER');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'FORFEITED');
CREATE TYPE "ExceptionType" AS ENUM ('AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "DepositType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT','UTILITIES','SUPPLIES','MARKETING','SOFTWARE','PAYROLL','TAX','INSURANCE','MAINTENANCE','OTHER');

CREATE TABLE "BusinessSettings" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "timezone" TEXT NOT NULL,
  "defaultLocale" TEXT NOT NULL,
  "supportedLocales" TEXT[] NOT NULL,
  "vatInclusive" BOOLEAN NOT NULL DEFAULT true,
  "defaultBufferMinutes" INTEGER NOT NULL DEFAULT 5,
  "minimumNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
  "maxAdvanceBookingDays" INTEGER NOT NULL DEFAULT 60,
  "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
  "depositType" "DepositType" NOT NULL DEFAULT 'NONE',
  "depositValueCents" INTEGER,
  "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Barber" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "bio" TEXT,
  "specialty" TEXT,
  "instagramUrl" TEXT,
  "imageUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "bufferMinutes" INTEGER,
  "commissionBps" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'BARBER',
  "barberId" TEXT,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(3),
  "lastLoginAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BarberService" (
  "barberId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "BarberService_pkey" PRIMARY KEY ("barberId","serviceId")
);

CREATE TABLE "BarberWorkingHours" (
  "id" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "isWorking" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "BarberWorkingHours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleException" (
  "id" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "type" "ExceptionType" NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "endAt" TIMESTAMPTZ(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "locale" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "endAt" TIMESTAMPTZ(3) NOT NULL,
  "blockedUntilAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "totalDurationMinutes" INTEGER NOT NULL,
  "totalPriceCents" INTEGER NOT NULL,
  "barberCommissionBps" INTEGER NOT NULL DEFAULT 0,
  "customerNote" TEXT,
  "consentGivenAt" TIMESTAMPTZ(3) NOT NULL,
  "consentPolicyVersion" TEXT NOT NULL,
  "cancellationTokenHash" TEXT,
  "rescheduleTokenHash" TEXT,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "depositAmountCents" INTEGER,
  "stripePaymentIntentId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingService" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "serviceNameSnapshot" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "barberId" TEXT,
  "preferredOn" DATE NOT NULL,
  "windowStart" VARCHAR(5),
  "windowEnd" VARCHAR(5),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperatingExpense" (
  "id" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "incurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
CREATE INDEX "Service_categoryId_isActive_sortOrder_idx" ON "Service"("categoryId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "Barber_slug_key" ON "Barber"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_barberId_key" ON "User"("barberId");
CREATE INDEX "BarberService_serviceId_idx" ON "BarberService"("serviceId");
CREATE UNIQUE INDEX "BarberWorkingHours_barberId_dayOfWeek_startTime_endTime_key" ON "BarberWorkingHours"("barberId", "dayOfWeek", "startTime", "endTime");
CREATE INDEX "BarberWorkingHours_barberId_dayOfWeek_idx" ON "BarberWorkingHours"("barberId", "dayOfWeek");
CREATE INDEX "ScheduleException_barberId_startAt_endAt_idx" ON "ScheduleException"("barberId", "startAt", "endAt");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "Customer_phoneE164_idx" ON "Customer"("phoneE164");
CREATE UNIQUE INDEX "Booking_publicId_key" ON "Booking"("publicId");
CREATE UNIQUE INDEX "Booking_cancellationTokenHash_key" ON "Booking"("cancellationTokenHash");
CREATE UNIQUE INDEX "Booking_rescheduleTokenHash_key" ON "Booking"("rescheduleTokenHash");
CREATE UNIQUE INDEX "Booking_stripePaymentIntentId_key" ON "Booking"("stripePaymentIntentId");
CREATE INDEX "Booking_barberId_startAt_idx" ON "Booking"("barberId", "startAt");
CREATE INDEX "Booking_customerId_startAt_idx" ON "Booking"("customerId", "startAt");
CREATE INDEX "Booking_status_startAt_idx" ON "Booking"("status", "startAt");
CREATE INDEX "BookingService_bookingId_sortOrder_idx" ON "BookingService"("bookingId", "sortOrder");
CREATE INDEX "WaitlistEntry_preferredOn_active_idx" ON "WaitlistEntry"("preferredOn", "active");
CREATE INDEX "WaitlistEntry_barberId_preferredOn_idx" ON "WaitlistEntry"("barberId", "preferredOn");
CREATE INDEX "OperatingExpense_incurredAt_idx" ON "OperatingExpense"("incurredAt");
CREATE INDEX "OperatingExpense_category_incurredAt_idx" ON "OperatingExpense"("category", "incurredAt");

ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BarberService" ADD CONSTRAINT "BarberService_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberService" ADD CONSTRAINT "BarberService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarberWorkingHours" ADD CONSTRAINT "BarberWorkingHours_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_live_overlap" EXCLUDE USING gist (
  "barberId" WITH =,
  tstzrange("startAt", "blockedUntilAt", '[)') WITH &&
) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_positive_duration" CHECK ("endAt" > "startAt" AND "blockedUntilAt" >= "endAt" AND "totalDurationMinutes" > 0 AND "totalPriceCents" >= 0 AND "barberCommissionBps" BETWEEN 0 AND 10000);
ALTER TABLE "Service" ADD CONSTRAINT "Service_positive_values" CHECK ("durationMinutes" > 0 AND "priceCents" >= 0 AND "costCents" >= 0);
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_commission_range" CHECK ("commissionBps" BETWEEN 0 AND 10000);
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_positive_values" CHECK ("durationMinutes" > 0 AND "priceCents" >= 0 AND "costCents" >= 0);
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_positive_amount" CHECK ("amountCents" > 0);
