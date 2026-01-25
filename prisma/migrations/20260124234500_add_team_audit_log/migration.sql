-- Add TeamAuditLog (Teams & Users audit trail)
-- Minimal, tenant-scoped, no secrets. Action is string enum-ish.

CREATE TABLE IF NOT EXISTS "TeamAuditLog" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetEmail" TEXT,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeamAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "TeamAuditLog_businessId_createdAt_idx" ON "TeamAuditLog"("businessId", "createdAt");

