-- Add image fields to SocialQueueItem table
-- Migration: Add image generation metadata fields

ALTER TABLE "SocialQueueItem" 
ADD COLUMN IF NOT EXISTS "imageStatus" TEXT,
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "imageAltText" TEXT,
ADD COLUMN IF NOT EXISTS "imageProvider" TEXT,
ADD COLUMN IF NOT EXISTS "imageAspect" TEXT,
ADD COLUMN IF NOT EXISTS "imageCategory" TEXT,
ADD COLUMN IF NOT EXISTS "imageErrorCode" TEXT,
ADD COLUMN IF NOT EXISTS "imageFallbackReason" TEXT;

-- Add imageSettings to SocialAutoposterSettings table
ALTER TABLE "SocialAutoposterSettings"
ADD COLUMN IF NOT EXISTS "imageSettings" JSONB;

