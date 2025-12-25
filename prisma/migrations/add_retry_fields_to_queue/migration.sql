-- Add retry fields to SocialQueueItem table
-- Migration: Add nextAttemptAt and lastErrorCode for retry logic

ALTER TABLE "SocialQueueItem" 
ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "SocialQueueItem_nextAttemptAt_idx" ON "SocialQueueItem"("nextAttemptAt");
CREATE INDEX IF NOT EXISTS "SocialQueueItem_userId_nextAttemptAt_idx" ON "SocialQueueItem"("userId", "nextAttemptAt");

