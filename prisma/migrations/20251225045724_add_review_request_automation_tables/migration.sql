-- CreateEnum
CREATE TYPE "ReviewRequestChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReviewRequestVariant" AS ENUM ('SMS_SHORT', 'SMS_STANDARD', 'EMAIL', 'FOLLOW_UP_SMS', 'FOLLOW_UP_EMAIL');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'SENT', 'CLICKED', 'REVIEWED', 'OPTED_OUT', 'SKIPPED');

-- CreateTable
CREATE TABLE "UsageCounter" (
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
CREATE TABLE "ReviewRequestCampaign" (
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
CREATE TABLE "ReviewRequestCustomer" (
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
CREATE TABLE "ReviewRequestQueueItem" (
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
CREATE TABLE "ReviewRequestDataset" (
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

-- CreateIndex
CREATE INDEX "UsageCounter_userId_appId_dayKey_idx" ON "UsageCounter"("userId", "appId", "dayKey");

-- CreateIndex
CREATE INDEX "UsageCounter_dayKey_idx" ON "UsageCounter"("dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_appId_dayKey_key" ON "UsageCounter"("userId", "appId", "dayKey");

-- CreateIndex
CREATE INDEX "ReviewRequestCampaign_userId_idx" ON "ReviewRequestCampaign"("userId");

-- CreateIndex
CREATE INDEX "ReviewRequestCampaign_userId_createdAt_idx" ON "ReviewRequestCampaign"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequestCustomer_userId_idx" ON "ReviewRequestCustomer"("userId");

-- CreateIndex
CREATE INDEX "ReviewRequestCustomer_campaignId_idx" ON "ReviewRequestCustomer"("campaignId");

-- CreateIndex
CREATE INDEX "ReviewRequestCustomer_userId_createdAt_idx" ON "ReviewRequestCustomer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequestQueueItem_userId_idx" ON "ReviewRequestQueueItem"("userId");

-- CreateIndex
CREATE INDEX "ReviewRequestQueueItem_campaignId_idx" ON "ReviewRequestQueueItem"("campaignId");

-- CreateIndex
CREATE INDEX "ReviewRequestQueueItem_customerId_idx" ON "ReviewRequestQueueItem"("customerId");

-- CreateIndex
CREATE INDEX "ReviewRequestQueueItem_userId_createdAt_idx" ON "ReviewRequestQueueItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequestQueueItem_status_idx" ON "ReviewRequestQueueItem"("status");

-- CreateIndex
CREATE INDEX "ReviewRequestDataset_userId_idx" ON "ReviewRequestDataset"("userId");

-- CreateIndex
CREATE INDEX "ReviewRequestDataset_campaignId_idx" ON "ReviewRequestDataset"("campaignId");

-- CreateIndex
CREATE INDEX "ReviewRequestDataset_userId_computedAt_idx" ON "ReviewRequestDataset"("userId", "computedAt");

-- CreateIndex
CREATE INDEX "ReviewRequestDataset_snapshotId_idx" ON "ReviewRequestDataset"("snapshotId");

-- CreateIndex
CREATE INDEX "ProReport_expiresAt_idx" ON "ProReport"("expiresAt");

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestCampaign" ADD CONSTRAINT "ReviewRequestCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestCustomer" ADD CONSTRAINT "ReviewRequestCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestCustomer" ADD CONSTRAINT "ReviewRequestCustomer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestQueueItem" ADD CONSTRAINT "ReviewRequestQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestQueueItem" ADD CONSTRAINT "ReviewRequestQueueItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestQueueItem" ADD CONSTRAINT "ReviewRequestQueueItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ReviewRequestCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestDataset" ADD CONSTRAINT "ReviewRequestDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestDataset" ADD CONSTRAINT "ReviewRequestDataset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
