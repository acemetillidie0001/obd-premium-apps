-- Follow-up migration: Add User foreign keys if User table exists
-- This migration is idempotent and safe to run multiple times
-- It will only add foreign keys if:
-- 1. The User table exists
-- 2. The foreign key constraint doesn't already exist

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='User'
  ) THEN
    -- Add foreign key for UsageCounter if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'UsageCounter_userId_fkey'
    ) THEN
      ALTER TABLE "UsageCounter" 
      ADD CONSTRAINT "UsageCounter_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ReviewRequestCampaign if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestCampaign_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestCampaign" 
      ADD CONSTRAINT "ReviewRequestCampaign_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ReviewRequestCustomer if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestCustomer_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestCustomer" 
      ADD CONSTRAINT "ReviewRequestCustomer_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ReviewRequestQueueItem if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ReviewRequestQueueItem_userId_fkey'
    ) THEN
      ALTER TABLE "ReviewRequestQueueItem" 
      ADD CONSTRAINT "ReviewRequestQueueItem_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Add foreign key for ReviewRequestDataset if it doesn't exist
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

