-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('facebook', 'instagram', 'x', 'googleBusiness');

-- CreateEnum
CREATE TYPE "PostingMode" AS ENUM ('review', 'auto', 'campaign');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('draft', 'approved', 'scheduled', 'posted', 'failed');

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialAutoposterSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandVoice" TEXT,
    "postingMode" TEXT NOT NULL DEFAULT 'review',
    "frequency" TEXT,
    "allowedDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timeWindowStart" TEXT,
    "timeWindowEnd" TEXT,
    "timezone" TEXT DEFAULT 'America/New_York',
    "enabledPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platformsEnabled" JSONB,
    "platformOverrides" JSONB,
    "contentPillarSettings" JSONB,
    "hashtagBankSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAutoposterSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "contentTheme" TEXT,
    "contentHash" TEXT,
    "contentFingerprint" TEXT,
    "reason" TEXT,
    "isSimilar" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SocialDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "responseData" JSONB,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (with IF NOT EXISTS for idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "SocialAutoposterSettings_userId_key" ON "SocialAutoposterSettings"("userId");

CREATE INDEX IF NOT EXISTS "SocialAutoposterSettings_userId_idx" ON "SocialAutoposterSettings"("userId");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_userId_idx" ON "SocialQueueItem"("userId");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_status_idx" ON "SocialQueueItem"("status");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_userId_status_idx" ON "SocialQueueItem"("userId", "status");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_scheduledAt_idx" ON "SocialQueueItem"("scheduledAt");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_userId_scheduledAt_idx" ON "SocialQueueItem"("userId", "scheduledAt");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_userId_platform_contentHash_idx" ON "SocialQueueItem"("userId", "platform", "contentHash");

CREATE INDEX IF NOT EXISTS "SocialQueueItem_contentHash_idx" ON "SocialQueueItem"("contentHash");

CREATE INDEX IF NOT EXISTS "SocialDeliveryAttempt_userId_idx" ON "SocialDeliveryAttempt"("userId");

CREATE INDEX IF NOT EXISTS "SocialDeliveryAttempt_queueItemId_idx" ON "SocialDeliveryAttempt"("queueItemId");

CREATE INDEX IF NOT EXISTS "SocialDeliveryAttempt_userId_attemptedAt_idx" ON "SocialDeliveryAttempt"("userId", "attemptedAt");

CREATE INDEX IF NOT EXISTS "SocialDeliveryAttempt_success_idx" ON "SocialDeliveryAttempt"("success");

-- Conditionally add foreign keys only if User table exists
-- This prevents hard failures when User table hasn't been created yet
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='User'
  ) THEN
    -- Add foreign key constraints to User table (if they don't already exist)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'SocialAutoposterSettings_userId_fkey'
    ) THEN
      ALTER TABLE "SocialAutoposterSettings" 
      ADD CONSTRAINT "SocialAutoposterSettings_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'SocialQueueItem_userId_fkey'
    ) THEN
      ALTER TABLE "SocialQueueItem" 
      ADD CONSTRAINT "SocialQueueItem_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'SocialDeliveryAttempt_userId_fkey'
    ) THEN
      ALTER TABLE "SocialDeliveryAttempt" 
      ADD CONSTRAINT "SocialDeliveryAttempt_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Add foreign keys between Social tables (these don't depend on User)
-- These are safe to add unconditionally since the tables are created above
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'SocialDeliveryAttempt_queueItemId_fkey'
  ) THEN
    ALTER TABLE "SocialDeliveryAttempt" 
    ADD CONSTRAINT "SocialDeliveryAttempt_queueItemId_fkey" 
    FOREIGN KEY ("queueItemId") REFERENCES "SocialQueueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;