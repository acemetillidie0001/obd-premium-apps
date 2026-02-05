-- CreateTable: ReviewResponseSnapshot
CREATE TABLE IF NOT EXISTS "ReviewResponseSnapshot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputSummary" JSONB NOT NULL,
    "responses" JSONB NOT NULL,

    CONSTRAINT "ReviewResponseSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ReviewResponseSnapshot
CREATE INDEX IF NOT EXISTS "ReviewResponseSnapshot_businessId_idx" ON "ReviewResponseSnapshot"("businessId");
CREATE INDEX IF NOT EXISTS "ReviewResponseSnapshot_businessId_createdAt_idx" ON "ReviewResponseSnapshot"("businessId", "createdAt");

