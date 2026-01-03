-- CreateTable
CREATE TABLE IF NOT EXISTS "SchedulerCalendarIntegration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disabled',
    "lastSyncAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "tokenRef" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerCalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchedulerCalendarIntegration_businessId_provider_key" ON "SchedulerCalendarIntegration"("businessId", "provider");

CREATE INDEX IF NOT EXISTS "SchedulerCalendarIntegration_businessId_idx" ON "SchedulerCalendarIntegration"("businessId");

CREATE INDEX IF NOT EXISTS "SchedulerCalendarIntegration_businessId_provider_idx" ON "SchedulerCalendarIntegration"("businessId", "provider");

CREATE INDEX IF NOT EXISTS "SchedulerCalendarIntegration_status_idx" ON "SchedulerCalendarIntegration"("status");

