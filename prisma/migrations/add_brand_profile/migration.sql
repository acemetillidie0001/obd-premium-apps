-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- Business Basics
    "businessName" TEXT,
    "businessType" TEXT,
    "city" TEXT,
    "state" TEXT,

    -- Brand Direction
    "brandPersonality" TEXT,
    "targetAudience" TEXT,
    "differentiators" TEXT,
    "inspirationBrands" TEXT,
    "avoidStyles" TEXT,

    -- Voice & Language
    "brandVoice" TEXT,
    "toneNotes" TEXT,
    "language" TEXT,

    -- Output Controls
    "industryKeywords" TEXT,
    "vibeKeywords" TEXT,
    "variationMode" TEXT,
    "includeHashtags" BOOLEAN NOT NULL DEFAULT false,
    "hashtagStyle" TEXT,

    -- Extras toggles
    "includeSocialPostTemplates" BOOLEAN NOT NULL DEFAULT false,
    "includeFAQStarter" BOOLEAN NOT NULL DEFAULT false,
    "includeGBPDescription" BOOLEAN NOT NULL DEFAULT false,
    "includeMetaDescription" BOOLEAN NOT NULL DEFAULT false,

    -- JSON fields for complex data
    "colorsJson" JSONB,
    "typographyJson" JSONB,
    "messagingJson" JSONB,
    "kitJson" JSONB,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE INDEX "BrandProfile_userId_idx" ON "BrandProfile"("userId");

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

