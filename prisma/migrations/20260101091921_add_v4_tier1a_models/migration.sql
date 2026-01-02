-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('REQUEST_ONLY', 'INSTANT_ALLOWED');

-- CreateEnum
CREATE TYPE "PaymentRequired" AS ENUM ('NONE', 'DEPOSIT', 'FULL');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('CLOSED_ALL_DAY', 'CUSTOM_HOURS');

-- AlterTable (only if tables exist)
DO $$
BEGIN
  -- Add bookingModeDefault to BookingSettings if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='BookingSettings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' 
        AND table_name='BookingSettings' 
        AND column_name='bookingModeDefault'
    ) THEN
      ALTER TABLE "BookingSettings" ADD COLUMN "bookingModeDefault" "BookingMode" NOT NULL DEFAULT 'REQUEST_ONLY';
    END IF;
  END IF;

  -- Add columns to BookingService if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='BookingService'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' 
        AND table_name='BookingService' 
        AND column_name='paymentRequired'
    ) THEN
      ALTER TABLE "BookingService" 
      ADD COLUMN "paymentRequired" "PaymentRequired" NOT NULL DEFAULT 'NONE',
      ADD COLUMN "depositAmountCents" INTEGER,
      ADD COLUMN "currency" TEXT DEFAULT 'USD';
    END IF;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AvailabilityWindow" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AvailabilityException" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "type" "AvailabilityExceptionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BookingTheme" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#29c4a9',
    "accentColor" TEXT,
    "headlineText" TEXT,
    "introText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (with IF NOT EXISTS for idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityWindow_businessId_dayOfWeek_key" ON "AvailabilityWindow"("businessId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "AvailabilityWindow_businessId_idx" ON "AvailabilityWindow"("businessId");

CREATE INDEX IF NOT EXISTS "AvailabilityWindow_businessId_dayOfWeek_idx" ON "AvailabilityWindow"("businessId", "dayOfWeek");

CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityException_businessId_date_key" ON "AvailabilityException"("businessId", "date");

CREATE INDEX IF NOT EXISTS "AvailabilityException_businessId_idx" ON "AvailabilityException"("businessId");

CREATE INDEX IF NOT EXISTS "AvailabilityException_businessId_date_idx" ON "AvailabilityException"("businessId", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "BookingTheme_businessId_key" ON "BookingTheme"("businessId");

CREATE INDEX IF NOT EXISTS "BookingTheme_businessId_idx" ON "BookingTheme"("businessId");

