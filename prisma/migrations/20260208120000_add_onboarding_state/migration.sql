-- Add OnboardingState (business-scoped onboarding UI dismissal flag)
-- Minimal: 1 row per Business (keyed by businessId)

-- CreateTable: OnboardingState
CREATE TABLE IF NOT EXISTS "OnboardingState" (
  "businessId" TEXT NOT NULL,
  "onboardingDismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("businessId")
);

-- CreateIndex: OnboardingState
CREATE INDEX IF NOT EXISTS "OnboardingState_businessId_idx" ON "OnboardingState"("businessId");

-- Foreign keys (conditionally add for idempotency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='Business'
  ) THEN
    -- OnboardingState.businessId -> Business.id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingState_businessId_fkey'
    ) THEN
      ALTER TABLE "OnboardingState"
      ADD CONSTRAINT "OnboardingState_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

