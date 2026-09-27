CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE', 'OTHER');

CREATE TABLE "ManualSale" (
  "id" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "totalRevenueCents" INTEGER NOT NULL,
  "directCostCents" INTEGER NOT NULL DEFAULT 0,
  "barberCommissionBps" INTEGER NOT NULL DEFAULT 0,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "note" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ManualSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualSaleItem" (
  "id" TEXT NOT NULL,
  "manualSaleId" TEXT NOT NULL,
  "serviceId" TEXT,
  "serviceNameSnapshot" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualSaleItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualSale_occurredAt_idx" ON "ManualSale"("occurredAt");
CREATE INDEX "ManualSale_barberId_occurredAt_idx" ON "ManualSale"("barberId", "occurredAt");
CREATE INDEX "ManualSale_createdByUserId_occurredAt_idx" ON "ManualSale"("createdByUserId", "occurredAt");
CREATE INDEX "ManualSaleItem_manualSaleId_sortOrder_idx" ON "ManualSaleItem"("manualSaleId", "sortOrder");
CREATE INDEX "ManualSaleItem_serviceId_idx" ON "ManualSaleItem"("serviceId");

ALTER TABLE "ManualSale" ADD CONSTRAINT "ManualSale_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualSale" ADD CONSTRAINT "ManualSale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualSaleItem" ADD CONSTRAINT "ManualSaleItem_manualSaleId_fkey" FOREIGN KEY ("manualSaleId") REFERENCES "ManualSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualSaleItem" ADD CONSTRAINT "ManualSaleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManualSale" ADD CONSTRAINT "ManualSale_financial_values" CHECK (
  "totalRevenueCents" > 0 AND "directCostCents" >= 0 AND "barberCommissionBps" BETWEEN 0 AND 10000
);
ALTER TABLE "ManualSaleItem" ADD CONSTRAINT "ManualSaleItem_financial_values" CHECK ("priceCents" >= 0 AND "costCents" >= 0);
