-- Tier 5B+: Optional shareable read-only SEO Audit report links
-- NOTE: This migration is added manually because `prisma migrate dev` shadow DB checks
-- can fail in this repo (see existing SEO audit report migration notes).

-- CreateTable
CREATE TABLE "SeoAuditShareToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "auditReportId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SeoAuditShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoAuditShareToken_businessId_idx" ON "SeoAuditShareToken"("businessId");

-- CreateIndex
CREATE INDEX "SeoAuditShareToken_auditReportId_idx" ON "SeoAuditShareToken"("auditReportId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoAuditShareToken_token_key" ON "SeoAuditShareToken"("token");

-- AddForeignKey
ALTER TABLE "SeoAuditShareToken" ADD CONSTRAINT "SeoAuditShareToken_auditReportId_fkey"
FOREIGN KEY ("auditReportId") REFERENCES "SeoAuditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;


