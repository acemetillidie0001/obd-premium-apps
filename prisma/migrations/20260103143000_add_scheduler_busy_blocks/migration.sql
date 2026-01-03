-- CreateTable: SchedulerBusyBlock
CREATE TABLE IF NOT EXISTS "SchedulerBusyBlock" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerBusyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SchedulerBusyBlock
CREATE INDEX IF NOT EXISTS "SchedulerBusyBlock_businessId_idx" ON "SchedulerBusyBlock"("businessId");
CREATE INDEX IF NOT EXISTS "SchedulerBusyBlock_businessId_start_idx" ON "SchedulerBusyBlock"("businessId", "start");
CREATE INDEX IF NOT EXISTS "SchedulerBusyBlock_businessId_end_idx" ON "SchedulerBusyBlock"("businessId", "end");

