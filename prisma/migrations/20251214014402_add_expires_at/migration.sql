-- CreateTable
CREATE TABLE "ProReport" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "pdfBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "businessName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "accessToken" TEXT,

    CONSTRAINT "ProReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProReport_shareId_key" ON "ProReport"("shareId");

-- CreateIndex
CREATE INDEX "ProReport_shareId_idx" ON "ProReport"("shareId");

-- CreateIndex
CREATE INDEX "ProReport_businessName_city_state_idx" ON "ProReport"("businessName", "city", "state");
