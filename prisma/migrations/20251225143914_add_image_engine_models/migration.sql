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
CREATE TABLE "ImageRequest" (
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
CREATE TABLE "ImageEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "messageSafe" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageRequest_status_idx" ON "ImageRequest"("status");

-- CreateIndex
CREATE INDEX "ImageRequest_platform_category_idx" ON "ImageRequest"("platform", "category");

-- CreateIndex
CREATE INDEX "ImageRequest_createdAt_idx" ON "ImageRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ImageEvent_requestId_idx" ON "ImageEvent"("requestId");

-- CreateIndex
CREATE INDEX "ImageEvent_createdAt_idx" ON "ImageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "ImageEvent" ADD CONSTRAINT "ImageEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ImageRequest"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialQueueItem" ADD CONSTRAINT "SocialQueueItem_imageRequestId_fkey" FOREIGN KEY ("imageRequestId") REFERENCES "ImageRequest"("requestId") ON DELETE SET NULL ON UPDATE CASCADE;

