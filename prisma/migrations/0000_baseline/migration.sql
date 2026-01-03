-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReviewRequestChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReviewRequestVariant" AS ENUM ('SMS_SHORT', 'SMS_STANDARD', 'EMAIL', 'FOLLOW_UP_SMS', 'FOLLOW_UP_EMAIL');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'SENT', 'CLICKED', 'REVIEWED', 'OPTED_OUT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('facebook', 'instagram', 'x', 'googleBusiness');

-- CreateEnum
CREATE TYPE "PostingMode" AS ENUM ('review', 'auto', 'campaign');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('draft', 'approved', 'scheduled', 'posted', 'failed');

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

-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('Lead', 'Active', 'Past', 'DoNotContact');

-- CreateEnum
CREATE TYPE "CrmContactSource" AS ENUM ('manual', 'scheduler', 'reviews', 'helpdesk', 'import');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'PROPOSED_TIME', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('REQUEST_ONLY', 'INSTANT_ALLOWED');

-- CreateEnum
CREATE TYPE "PaymentRequired" AS ENUM ('NONE', 'DEPOSIT', 'FULL');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('CLOSED_ALL_DAY', 'CUSTOM_HOURS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ProReport" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "pdfBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "businessName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "accessToken" TEXT,

    CONSTRAINT "ProReport_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessName" TEXT,
    "businessType" TEXT,
    "city" TEXT,
    "state" TEXT,
    "brandPersonality" TEXT,
    "targetAudience" TEXT,
    "differentiators" TEXT,
    "inspirationBrands" TEXT,
    "avoidStyles" TEXT,
    "brandVoice" TEXT,
    "toneNotes" TEXT,
    "language" TEXT,
    "industryKeywords" TEXT,
    "vibeKeywords" TEXT,
    "variationMode" TEXT,
    "includeHashtags" BOOLEAN NOT NULL DEFAULT false,
    "hashtagStyle" TEXT,
    "includeSocialPostTemplates" BOOLEAN NOT NULL DEFAULT false,
    "includeFAQStarter" BOOLEAN NOT NULL DEFAULT false,
    "includeGBPDescription" BOOLEAN NOT NULL DEFAULT false,
    "includeMetaDescription" BOOLEAN NOT NULL DEFAULT false,
    "colorsJson" JSONB,
    "typographyJson" JSONB,
    "messagingJson" JSONB,
    "kitJson" JSONB,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "SocialAutoposterSettings" (
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
    "imageSettings" JSONB,

    CONSTRAINT "SocialAutoposterSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialQueueItem" (
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
    "imageStatus" TEXT,
    "imageUrl" TEXT,
    "imageAltText" TEXT,
    "imageProvider" TEXT,
    "imageAspect" TEXT,
    "imageCategory" TEXT,
    "imageErrorCode" TEXT,
    "imageFallbackReason" TEXT,
    "imageRequestId" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,

    CONSTRAINT "SocialQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialDeliveryAttempt" (
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

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "address" TEXT,
    "status" "CrmContactStatus" NOT NULL DEFAULT 'Lead',
    "source" "CrmContactSource" NOT NULL DEFAULT 'manual',
    "nextFollowUpAt" TIMESTAMP(3),
    "nextFollowUpNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTag" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContactTag" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmContactTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContactActivity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT,
    "summary" TEXT,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContactActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingService" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paymentRequired" "PaymentRequired" NOT NULL DEFAULT 'NONE',
    "depositAmountCents" INTEGER,
    "currency" TEXT DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingModeDefault" "BookingMode" NOT NULL DEFAULT 'REQUEST_ONLY',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxDaysOut" INTEGER NOT NULL DEFAULT 90,
    "policyText" TEXT,
    "bookingKey" TEXT NOT NULL,
    "notificationEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPublicLink" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "preferredStart" TIMESTAMP(3),
    "preferredEnd" TIMESTAMP(3),
    "message" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "proposedStart" TIMESTAMP(3),
    "proposedEnd" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequestAuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "BookingStatus" NOT NULL,
    "toStatus" "BookingStatus" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRequestAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "routeKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "hashedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "type" "AvailabilityExceptionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTheme" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#29c4a9',
    "accentColor" TEXT,
    "headlineText" TEXT,
    "introText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerCalendarConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "ProReport_shareId_key" ON "ProReport"("shareId");

-- CreateIndex
CREATE INDEX "ProReport_shareId_idx" ON "ProReport"("shareId");

-- CreateIndex
CREATE INDEX "ProReport_businessName_city_state_idx" ON "ProReport"("businessName", "city", "state");

-- CreateIndex
CREATE INDEX "ProReport_expiresAt_idx" ON "ProReport"("expiresAt");

-- CreateIndex
CREATE INDEX "UsageCounter_userId_appId_dayKey_idx" ON "UsageCounter"("userId", "appId", "dayKey");

-- CreateIndex
CREATE INDEX "UsageCounter_dayKey_idx" ON "UsageCounter"("dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_appId_dayKey_key" ON "UsageCounter"("userId", "appId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE INDEX "BrandProfile_userId_idx" ON "BrandProfile"("userId");

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
CREATE UNIQUE INDEX "SocialAutoposterSettings_userId_key" ON "SocialAutoposterSettings"("userId");

-- CreateIndex
CREATE INDEX "SocialAutoposterSettings_userId_idx" ON "SocialAutoposterSettings"("userId");

-- CreateIndex
CREATE INDEX "SocialQueueItem_userId_idx" ON "SocialQueueItem"("userId");

-- CreateIndex
CREATE INDEX "SocialQueueItem_status_idx" ON "SocialQueueItem"("status");

-- CreateIndex
CREATE INDEX "SocialQueueItem_userId_status_idx" ON "SocialQueueItem"("userId", "status");

-- CreateIndex
CREATE INDEX "SocialQueueItem_scheduledAt_idx" ON "SocialQueueItem"("scheduledAt");

-- CreateIndex
CREATE INDEX "SocialQueueItem_userId_scheduledAt_idx" ON "SocialQueueItem"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "SocialQueueItem_nextAttemptAt_idx" ON "SocialQueueItem"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "SocialQueueItem_userId_nextAttemptAt_idx" ON "SocialQueueItem"("userId", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SocialQueueItem_userId_platform_contentHash_idx" ON "SocialQueueItem"("userId", "platform", "contentHash");

-- CreateIndex
CREATE INDEX "SocialQueueItem_contentHash_idx" ON "SocialQueueItem"("contentHash");

-- CreateIndex
CREATE INDEX "SocialDeliveryAttempt_userId_idx" ON "SocialDeliveryAttempt"("userId");

-- CreateIndex
CREATE INDEX "SocialDeliveryAttempt_queueItemId_idx" ON "SocialDeliveryAttempt"("queueItemId");

-- CreateIndex
CREATE INDEX "SocialDeliveryAttempt_userId_attemptedAt_idx" ON "SocialDeliveryAttempt"("userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "SocialDeliveryAttempt_success_idx" ON "SocialDeliveryAttempt"("success");

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

-- CreateIndex
CREATE INDEX "CrmContact_businessId_idx" ON "CrmContact"("businessId");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_status_idx" ON "CrmContact"("businessId", "status");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_updatedAt_idx" ON "CrmContact"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_name_idx" ON "CrmContact"("businessId", "name");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_nextFollowUpAt_idx" ON "CrmContact"("businessId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "CrmTag_businessId_idx" ON "CrmTag"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTag_businessId_name_key" ON "CrmTag"("businessId", "name");

-- CreateIndex
CREATE INDEX "CrmContactTag_contactId_idx" ON "CrmContactTag"("contactId");

-- CreateIndex
CREATE INDEX "CrmContactTag_tagId_idx" ON "CrmContactTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContactTag_contactId_tagId_key" ON "CrmContactTag"("contactId", "tagId");

-- CreateIndex
CREATE INDEX "CrmContactActivity_contactId_idx" ON "CrmContactActivity"("contactId");

-- CreateIndex
CREATE INDEX "CrmContactActivity_businessId_idx" ON "CrmContactActivity"("businessId");

-- CreateIndex
CREATE INDEX "CrmContactActivity_businessId_createdAt_idx" ON "CrmContactActivity"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmContactActivity_businessId_occurredAt_idx" ON "CrmContactActivity"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "BookingService_businessId_idx" ON "BookingService"("businessId");

-- CreateIndex
CREATE INDEX "BookingService_businessId_active_idx" ON "BookingService"("businessId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_businessId_key" ON "BookingSettings"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_bookingKey_key" ON "BookingSettings"("bookingKey");

-- CreateIndex
CREATE INDEX "BookingSettings_businessId_idx" ON "BookingSettings"("businessId");

-- CreateIndex
CREATE INDEX "BookingSettings_bookingKey_idx" ON "BookingSettings"("bookingKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPublicLink_businessId_key" ON "BookingPublicLink"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPublicLink_code_key" ON "BookingPublicLink"("code");

-- CreateIndex
CREATE INDEX "BookingPublicLink_businessId_idx" ON "BookingPublicLink"("businessId");

-- CreateIndex
CREATE INDEX "BookingPublicLink_code_idx" ON "BookingPublicLink"("code");

-- CreateIndex
CREATE INDEX "BookingPublicLink_slug_idx" ON "BookingPublicLink"("slug");

-- CreateIndex
CREATE INDEX "BookingRequest_businessId_idx" ON "BookingRequest"("businessId");

-- CreateIndex
CREATE INDEX "BookingRequest_businessId_status_idx" ON "BookingRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "BookingRequest_businessId_createdAt_idx" ON "BookingRequest"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingRequest_status_idx" ON "BookingRequest"("status");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_businessId_idx" ON "BookingRequestAuditLog"("businessId");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_requestId_idx" ON "BookingRequestAuditLog"("requestId");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_requestId_createdAt_idx" ON "BookingRequestAuditLog"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_businessId_createdAt_idx" ON "BookingRequestAuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitEvent_businessId_idx" ON "RateLimitEvent"("businessId");

-- CreateIndex
CREATE INDEX "RateLimitEvent_businessId_day_idx" ON "RateLimitEvent"("businessId", "day");

-- CreateIndex
CREATE INDEX "RateLimitEvent_routeKey_day_idx" ON "RateLimitEvent"("routeKey", "day");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitEvent_businessId_routeKey_day_key" ON "RateLimitEvent"("businessId", "routeKey", "day");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_businessId_idx" ON "AvailabilityWindow"("businessId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_businessId_dayOfWeek_idx" ON "AvailabilityWindow"("businessId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityWindow_businessId_dayOfWeek_key" ON "AvailabilityWindow"("businessId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityException_businessId_idx" ON "AvailabilityException"("businessId");

-- CreateIndex
CREATE INDEX "AvailabilityException_businessId_date_idx" ON "AvailabilityException"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_businessId_date_key" ON "AvailabilityException"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BookingTheme_businessId_key" ON "BookingTheme"("businessId");

-- CreateIndex
CREATE INDEX "BookingTheme_businessId_idx" ON "BookingTheme"("businessId");

-- CreateIndex
CREATE INDEX "SchedulerCalendarConnection_businessId_idx" ON "SchedulerCalendarConnection"("businessId");

-- CreateIndex
CREATE INDEX "SchedulerCalendarConnection_businessId_provider_idx" ON "SchedulerCalendarConnection"("businessId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulerCalendarConnection_businessId_provider_key" ON "SchedulerCalendarConnection"("businessId", "provider");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestCustomer" ADD CONSTRAINT "ReviewRequestCustomer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestQueueItem" ADD CONSTRAINT "ReviewRequestQueueItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestQueueItem" ADD CONSTRAINT "ReviewRequestQueueItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ReviewRequestCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestDataset" ADD CONSTRAINT "ReviewRequestDataset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReviewRequestCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialDeliveryAttempt" ADD CONSTRAINT "SocialDeliveryAttempt_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "SocialQueueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageEvent" ADD CONSTRAINT "ImageEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ImageRequest"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactTag" ADD CONSTRAINT "CrmContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactTag" ADD CONSTRAINT "CrmContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CrmTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactActivity" ADD CONSTRAINT "CrmContactActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BookingService"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BookingRequestAuditLog" ADD CONSTRAINT "BookingRequestAuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

