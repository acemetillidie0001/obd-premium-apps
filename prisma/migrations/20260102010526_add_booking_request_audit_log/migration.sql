-- CreateEnum (if it doesn't exist)
-- BookingStatus enum may not exist yet, so create it first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'BookingStatus'
  ) THEN
    CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'PROPOSED_TIME', 'COMPLETED', 'CANCELED');
  END IF;
END $$;

-- CreateTable (only if BookingRequest table exists, since we reference it)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='BookingRequest'
  ) THEN
    CREATE TABLE IF NOT EXISTS "BookingRequestAuditLog" (
      "id" TEXT NOT NULL,
      "businessId" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "actorUserId" TEXT,
      "action" TEXT NOT NULL,
      "fromStatus" "BookingStatus" NOT NULL,
      "toStatus" "BookingStatus" NOT NULL,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "BookingRequestAuditLog_pkey" PRIMARY KEY ("id")
    );

    -- CreateIndex (with IF NOT EXISTS for idempotency)
    CREATE INDEX IF NOT EXISTS "BookingRequestAuditLog_businessId_idx" ON "BookingRequestAuditLog"("businessId");

    CREATE INDEX IF NOT EXISTS "BookingRequestAuditLog_requestId_idx" ON "BookingRequestAuditLog"("requestId");

    CREATE INDEX IF NOT EXISTS "BookingRequestAuditLog_requestId_createdAt_idx" ON "BookingRequestAuditLog"("requestId", "createdAt");

    CREATE INDEX IF NOT EXISTS "BookingRequestAuditLog_businessId_createdAt_idx" ON "BookingRequestAuditLog"("businessId", "createdAt");

    -- AddForeignKey (if it doesn't exist)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'BookingRequestAuditLog_requestId_fkey'
    ) THEN
      ALTER TABLE "BookingRequestAuditLog" 
      ADD CONSTRAINT "BookingRequestAuditLog_requestId_fkey" 
      FOREIGN KEY ("requestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

