-- CreateEnum
CREATE TYPE "ReviewRequestChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReviewRequestVariant" AS ENUM ('SMS_SHORT', 'SMS_STANDARD', 'EMAIL', 'FOLLOW_UP_SMS', 'FOLLOW_UP_EMAIL');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'SENT', 'CLICKED', 'REVIEWED', 'OPTED_OUT', 'SKIPPED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "conceptsCount" INTEGER NOT NULL DEFAULT 0,
    "imagesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewRequestCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT,
    "campaignName" TEXT,
    "platform" TEXT NOT NULL,
    "reviewLinkUrl" TEXT NOT NULL,
    "languageMode" TEXT NOT NULL,
    "toneStyle" TEXT NOT NULL,
    "brandVoice" TEXT,
    "channelMode" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "sendDelayHours" INTEGER NOT NULL DEFAULT 24,
    "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "followUpDelayDays" INTEGER,
    "frequencyCapDays" INTEGER NOT NULL DEFAULT 30,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequestCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewRequestCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastVisitDate" TIMESTAMP(3),
    "serviceType" TEXT,
    "jobId" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequestCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewRequestQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "channel" "ReviewRequestChannel" NOT NULL,
    "variant" "ReviewRequestVariant" NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'PENDING',
    "skippedReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequestQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewRequestDataset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalsJson" JSONB NOT NULL,
    "warningsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequestDataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (with IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "UsageCounter_userId_appId_dayKey_idx" ON "UsageCounter"("userId", "appId", "dayKey");
CREATE INDEX IF NOT EXISTS "UsageCounter_dayKey_idx" ON "UsageCounter"("dayKey");
CREATE UNIQUE INDEX IF NOT EXISTS "UsageCounter_userId_appId_dayKey_key" ON "UsageCounter"("userId", "appId", "dayKey");

CREATE INDEX IF NOT EXISTS "ReviewRequestCampaign_userId_idx" ON "ReviewRequestCampaign"("userId");
CREATE INDEX IF NOT EXISTS "ReviewRequestCampaign_userId_createdAt_idx" ON "ReviewRequestCampaign"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReviewRequestCustomer_userId_idx" ON "ReviewRequestCustomer"("userId");
CREATE INDEX IF NOT EXISTS "ReviewRequestCustomer_campaignId_idx" ON "ReviewRequestCustomer"("campaignId");
CREATE INDEX IF NOT EXISTS "ReviewRequestCustomer_userId_createdAt_idx" ON "ReviewRequestCustomer"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReviewRequestQueueItem_userId_idx" ON "ReviewRequestQueueItem"("userId");
CREATE INDEX IF NOT EXISTS "ReviewRequestQueueItem_campaignId_idx" ON "ReviewRequestQueueItem"("campaignId");
CREATE INDEX IF NOT EXISTS "ReviewRequestQueueItem_customerId_idx" ON "ReviewRequestQueueItem"("customerId");
CREATE INDEX IF NOT EXISTS "ReviewRequestQueueItem_userId_createdAt_idx" ON "ReviewRequestQueueItem"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReviewRequestQueueItem_status_idx" ON "ReviewRequestQueueItem"("status");

CREATE INDEX IF NOT EXISTS "ReviewRequestDataset_userId_idx" ON "ReviewRequestDataset"("userId");
CREATE INDEX IF NOT EXISTS "ReviewRequestDataset_campaignId_idx" ON "ReviewRequestDataset"("campaignId");
CREATE INDEX IF NOT EXISTS "ReviewRequestDataset_userId_computedAt_idx" ON "ReviewRequestDataset"("userId", "computedAt");
CREATE INDEX IF NOT EXISTS "ReviewRequestDataset_snapshotId_idx" ON "ReviewRequestDataset"("snapshotId");

CREATE INDEX IF NOT EXISTS "ProReport_expiresAt_idx" ON "ProReport"("expiresAt");

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
      WHERE conname = 'UsageCounter_userId_fkey'
    ) THEN
      ALTER TABLE "UsageCounter" 
      ADD CONSTRAINT "UsageCounter_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestCampaign_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestCampaign" 
      ADD CONSTRAINT "ReviewRequestCampaign_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestCustomer_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestCustomer" 
      ADD CONSTRAINT "ReviewRequestCustomer_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestQueueItem_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestQueueItem" 
      ADD CONSTRAINT "ReviewRequestQueueItem_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestDataset_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestDataset" 
      ADD CONSTRAINT "ReviewRequestDataset_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Add foreign keys between Review Request tables (these don't depend on User)
-- These are safe to add unconditionally since the tables are created above
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ReviewRequestCustomer_campaignId_fkey'
    ) THEN
        ALTER TABLE "ReviewRequestCustomer" 
        ADD CONSTRAINT "ReviewRequestCustomer_campaignId_fkey" 
        FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ReviewRequestQueueItem_campaignId_fkey'
    ) THEN
        ALTER TABLE "ReviewRequestQueueItem" 
        ADD CONSTRAINT "ReviewRequestQueueItem_campaignId_fkey" 
        FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ReviewRequestQueueItem_customerId_fkey'
    ) THEN
        ALTER TABLE "ReviewRequestQueueItem" 
        ADD CONSTRAINT "ReviewRequestQueueItem_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "ReviewRequestCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ReviewRequestDataset_campaignId_fkey'
    ) THEN
        ALTER TABLE "ReviewRequestDataset" 
        ADD CONSTRAINT "ReviewRequestDataset_campaignId_fkey" 
        FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
