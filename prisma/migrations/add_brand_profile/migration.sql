-- CreateTable
CREATE TABLE IF NOT EXISTS "BrandProfile" (
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

-- CreateIndex (with IF NOT EXISTS for idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "BrandProfile_userId_key" ON "BrandProfile"("userId");

CREATE INDEX IF NOT EXISTS "BrandProfile_userId_idx" ON "BrandProfile"("userId");

-- Conditionally add foreign key only if User table exists
-- This prevents hard failures when User table hasn't been created yet
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='User'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'BrandProfile_userId_fkey'
    ) THEN
      ALTER TABLE "BrandProfile" 
      ADD CONSTRAINT "BrandProfile_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

