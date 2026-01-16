-- Tier 5B: Canonical deterministic SEO Audit report snapshots
-- NOTE: This migration was added manually because `prisma migrate dev --create-only`
-- currently fails in this repo due to an existing shadow DB migration issue (P3006).

-- CreateEnum
CREATE TYPE "SeoAuditReportStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateTable
CREATE TABLE "SeoAuditReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "SeoAuditReportStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceInput" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "roadmap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SeoAuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoAuditReport_businessId_idx" ON "SeoAuditReport"("businessId");

-- CreateIndex
CREATE INDEX "SeoAuditReport_businessId_status_completedAt_idx" ON "SeoAuditReport"("businessId", "status", "completedAt");


