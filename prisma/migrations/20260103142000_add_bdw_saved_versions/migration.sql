-- CreateTable: BusinessDescriptionSavedVersion
CREATE TABLE IF NOT EXISTS "BusinessDescriptionSavedVersion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "versionName" TEXT,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDescriptionSavedVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BusinessDescriptionSavedVersion
CREATE INDEX IF NOT EXISTS "BusinessDescriptionSavedVersion_businessId_idx" ON "BusinessDescriptionSavedVersion"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessDescriptionSavedVersion_businessId_isActive_idx" ON "BusinessDescriptionSavedVersion"("businessId", "isActive");

