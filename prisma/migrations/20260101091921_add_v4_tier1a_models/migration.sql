-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('REQUEST_ONLY', 'INSTANT_ALLOWED');

-- CreateEnum
CREATE TYPE "PaymentRequired" AS ENUM ('NONE', 'DEPOSIT', 'FULL');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('CLOSED_ALL_DAY', 'CUSTOM_HOURS');

-- AlterTable
ALTER TABLE "BookingSettings" ADD COLUMN "bookingModeDefault" "BookingMode" NOT NULL DEFAULT 'REQUEST_ONLY';

-- AlterTable
ALTER TABLE "BookingService" ADD COLUMN "paymentRequired" "PaymentRequired" NOT NULL DEFAULT 'NONE',
ADD COLUMN "depositAmountCents" INTEGER,
ADD COLUMN "currency" TEXT DEFAULT 'USD';

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
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
CREATE TABLE "AvailabilityException" (
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
CREATE TABLE "BookingTheme" (
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

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityWindow_businessId_dayOfWeek_key" ON "AvailabilityWindow"("businessId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_businessId_idx" ON "AvailabilityWindow"("businessId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_businessId_dayOfWeek_idx" ON "AvailabilityWindow"("businessId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_businessId_date_key" ON "AvailabilityException"("businessId", "date");

-- CreateIndex
CREATE INDEX "AvailabilityException_businessId_idx" ON "AvailabilityException"("businessId");

-- CreateIndex
CREATE INDEX "AvailabilityException_businessId_date_idx" ON "AvailabilityException"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BookingTheme_businessId_key" ON "BookingTheme"("businessId");

-- CreateIndex
CREATE INDEX "BookingTheme_businessId_idx" ON "BookingTheme"("businessId");

