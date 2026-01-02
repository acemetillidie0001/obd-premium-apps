-- AlterTable (only if BookingSettings table exists)
-- This migration may run before BookingSettings is created, so we check first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='BookingSettings'
  ) THEN
    -- Check if column already exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' 
        AND table_name='BookingSettings' 
        AND column_name='notificationEmail'
    ) THEN
      ALTER TABLE "BookingSettings" ADD COLUMN "notificationEmail" TEXT;
    END IF;
  END IF;
END $$;

