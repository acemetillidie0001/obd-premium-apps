-- CreateEnum
CREATE TYPE "ImagePlatform" AS ENUM ('instagram', 'facebook', 'x', 'gbp');

-- CreateEnum
CREATE TYPE "ImageCategory" AS ENUM ('educational', 'promotion', 'social_proof', 'local_abstract', 'evergreen');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('queued', 'generated', 'fallback', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "ImageProvider" AS ENUM ('nanoBananaFlash', 'stub');

-- CreateEnum
CREATE TYPE "ImageStorage" AS ENUM ('localDev', 'vercelBlob');

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImageRequest" (
    "requestId" TEXT NOT NULL,
    "status" "ImageStatus" NOT NULL DEFAULT 'queued',
    "platform" "ImagePlatform" NOT NULL,
    "category" "ImageCategory" NOT NULL,
    "aspect" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "provider" "ImageProvider",
    "storage" "ImageStorage",
    "imageUrl" TEXT,
    "altText" TEXT,
    "errorCode" TEXT,
    "errorMessageSafe" TEXT,
    "fallbackReason" TEXT,
    "decisionJson" JSONB,
    "promptHash" TEXT,
    "inputHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageRequest_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImageEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "messageSafe" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (with IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "ImageRequest_status_idx" ON "ImageRequest"("status");

CREATE INDEX IF NOT EXISTS "ImageRequest_platform_category_idx" ON "ImageRequest"("platform", "category");

CREATE INDEX IF NOT EXISTS "ImageRequest_createdAt_idx" ON "ImageRequest"("createdAt");

CREATE INDEX IF NOT EXISTS "ImageEvent_requestId_idx" ON "ImageEvent"("requestId");

CREATE INDEX IF NOT EXISTS "ImageEvent_createdAt_idx" ON "ImageEvent"("createdAt");

-- AddForeignKey (these reference tables created in this migration, so they're safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ImageEvent_requestId_fkey'
  ) THEN
    ALTER TABLE "ImageEvent" 
    ADD CONSTRAINT "ImageEvent_requestId_fkey" 
    FOREIGN KEY ("requestId") REFERENCES "ImageRequest"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Check if SocialQueueItem table exists AND imageRequestId column exists before adding foreign key
  -- The imageRequestId column is added in a later migration, so we must check for it
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='SocialQueueItem'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' 
      AND table_name='SocialQueueItem' 
      AND column_name='imageRequestId'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'SocialQueueItem_imageRequestId_fkey'
    ) THEN
      ALTER TABLE "SocialQueueItem" 
      ADD CONSTRAINT "SocialQueueItem_imageRequestId_fkey" 
      FOREIGN KEY ("imageRequestId") REFERENCES "ImageRequest"("requestId") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

