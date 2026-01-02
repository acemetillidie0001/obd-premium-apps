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

-- CreateIndex
CREATE INDEX "RateLimitEvent_businessId_idx" ON "RateLimitEvent"("businessId");

-- CreateIndex
CREATE INDEX "RateLimitEvent_businessId_day_idx" ON "RateLimitEvent"("businessId", "day");

-- CreateIndex
CREATE INDEX "RateLimitEvent_routeKey_day_idx" ON "RateLimitEvent"("routeKey", "day");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX "RateLimitEvent_businessId_routeKey_day_key" ON "RateLimitEvent"("businessId", "routeKey", "day");

