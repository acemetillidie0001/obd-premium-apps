-- CreateEnum: AiHelpDeskEntryType
DO $$ BEGIN
 CREATE TYPE "AiHelpDeskEntryType" AS ENUM('FAQ', 'SERVICE', 'POLICY', 'NOTE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AiHelpDeskResponseQuality
DO $$ BEGIN
 CREATE TYPE "AiHelpDeskResponseQuality" AS ENUM('GOOD', 'WEAK', 'NONE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable: AiHelpDeskEntry
CREATE TABLE IF NOT EXISTS "AiHelpDeskEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "AiHelpDeskEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiHelpDeskEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiHelpDeskQuestionLog
CREATE TABLE IF NOT EXISTS "AiHelpDeskQuestionLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "hasSources" BOOLEAN NOT NULL DEFAULT false,
    "sourcesCount" INTEGER NOT NULL DEFAULT 0,
    "responseQuality" "AiHelpDeskResponseQuality",
    "matchedEntryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiHelpDeskQuestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiHelpDeskWidgetKey
CREATE TABLE IF NOT EXISTS "AiHelpDeskWidgetKey" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "AiHelpDeskWidgetKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiHelpDeskWidgetSettings
CREATE TABLE IF NOT EXISTS "AiHelpDeskWidgetSettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "brandColor" TEXT DEFAULT '#29c4a9',
    "greeting" TEXT DEFAULT 'Hi! How can I help you today?',
    "position" TEXT DEFAULT 'bottom-right',
    "assistantAvatarUrl" TEXT,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiHelpDeskWidgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiHelpDeskSyncState
CREATE TABLE IF NOT EXISTS "AiHelpDeskSyncState" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiHelpDeskSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiWorkspaceMap
CREATE TABLE IF NOT EXISTS "AiWorkspaceMap" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "workspaceSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWorkspaceMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AiHelpDeskEntry
CREATE INDEX IF NOT EXISTS "AiHelpDeskEntry_businessId_idx" ON "AiHelpDeskEntry"("businessId");
CREATE INDEX IF NOT EXISTS "AiHelpDeskEntry_businessId_type_idx" ON "AiHelpDeskEntry"("businessId", "type");
CREATE INDEX IF NOT EXISTS "AiHelpDeskEntry_businessId_isActive_idx" ON "AiHelpDeskEntry"("businessId", "isActive");

-- CreateIndex: AiHelpDeskQuestionLog
CREATE INDEX IF NOT EXISTS "AiHelpDeskQuestionLog_businessId_idx" ON "AiHelpDeskQuestionLog"("businessId");
CREATE INDEX IF NOT EXISTS "AiHelpDeskQuestionLog_businessId_createdAt_idx" ON "AiHelpDeskQuestionLog"("businessId", "createdAt");

-- CreateIndex: AiHelpDeskWidgetKey
CREATE UNIQUE INDEX IF NOT EXISTS "AiHelpDeskWidgetKey_businessId_key" ON "AiHelpDeskWidgetKey"("businessId");
CREATE INDEX IF NOT EXISTS "AiHelpDeskWidgetKey_businessId_idx" ON "AiHelpDeskWidgetKey"("businessId");

-- CreateIndex: AiHelpDeskWidgetSettings
CREATE UNIQUE INDEX IF NOT EXISTS "AiHelpDeskWidgetSettings_businessId_key" ON "AiHelpDeskWidgetSettings"("businessId");
CREATE INDEX IF NOT EXISTS "AiHelpDeskWidgetSettings_businessId_idx" ON "AiHelpDeskWidgetSettings"("businessId");

-- CreateIndex: AiHelpDeskSyncState
CREATE UNIQUE INDEX IF NOT EXISTS "AiHelpDeskSyncState_businessId_key" ON "AiHelpDeskSyncState"("businessId");
CREATE INDEX IF NOT EXISTS "AiHelpDeskSyncState_businessId_idx" ON "AiHelpDeskSyncState"("businessId");

-- CreateIndex: AiWorkspaceMap
CREATE UNIQUE INDEX IF NOT EXISTS "AiWorkspaceMap_businessId_key" ON "AiWorkspaceMap"("businessId");
CREATE INDEX IF NOT EXISTS "AiWorkspaceMap_businessId_idx" ON "AiWorkspaceMap"("businessId");
CREATE INDEX IF NOT EXISTS "AiWorkspaceMap_workspaceSlug_idx" ON "AiWorkspaceMap"("workspaceSlug");

