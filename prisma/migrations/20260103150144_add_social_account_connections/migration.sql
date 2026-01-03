-- CreateTable: SocialAccountConnection
CREATE TABLE IF NOT EXISTS "SocialAccountConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: SocialAccountConnection
CREATE UNIQUE INDEX IF NOT EXISTS "SocialAccountConnection_userId_platform_providerAccountId_key" ON "SocialAccountConnection"("userId", "platform", "providerAccountId");

-- CreateIndex: SocialAccountConnection
CREATE INDEX IF NOT EXISTS "SocialAccountConnection_userId_idx" ON "SocialAccountConnection"("userId");
CREATE INDEX IF NOT EXISTS "SocialAccountConnection_userId_platform_idx" ON "SocialAccountConnection"("userId", "platform");

-- CreateTable: SocialPostingDestination
CREATE TABLE IF NOT EXISTS "SocialPostingDestination" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "selectedAccountId" TEXT,
    "selectedDisplayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPostingDestination_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: SocialPostingDestination
CREATE UNIQUE INDEX IF NOT EXISTS "SocialPostingDestination_userId_platform_key" ON "SocialPostingDestination"("userId", "platform");

-- CreateIndex: SocialPostingDestination
CREATE INDEX IF NOT EXISTS "SocialPostingDestination_userId_idx" ON "SocialPostingDestination"("userId");
CREATE INDEX IF NOT EXISTS "SocialPostingDestination_userId_platform_idx" ON "SocialPostingDestination"("userId", "platform");

-- CreateTable: SocialPublishAttempt
CREATE TABLE IF NOT EXISTS "SocialPublishAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'test',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerPostId" TEXT,
    "providerPermalink" TEXT,
    "errorMessage" TEXT,
    "responseData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPublishAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SocialPublishAttempt
CREATE INDEX IF NOT EXISTS "SocialPublishAttempt_userId_idx" ON "SocialPublishAttempt"("userId");
CREATE INDEX IF NOT EXISTS "SocialPublishAttempt_userId_platform_idx" ON "SocialPublishAttempt"("userId", "platform");
CREATE INDEX IF NOT EXISTS "SocialPublishAttempt_userId_createdAt_idx" ON "SocialPublishAttempt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SocialPublishAttempt_status_idx" ON "SocialPublishAttempt"("status");

