-- Add imageRequestId field to SocialQueueItem table
-- Migration: Add image request ID for caching

ALTER TABLE "SocialQueueItem" 
ADD COLUMN IF NOT EXISTS "imageRequestId" TEXT;

