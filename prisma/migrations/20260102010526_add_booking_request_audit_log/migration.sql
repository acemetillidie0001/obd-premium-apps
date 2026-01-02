-- CreateTable
CREATE TABLE "BookingRequestAuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "BookingStatus" NOT NULL,
    "toStatus" "BookingStatus" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRequestAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_businessId_idx" ON "BookingRequestAuditLog"("businessId");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_requestId_idx" ON "BookingRequestAuditLog"("requestId");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_requestId_createdAt_idx" ON "BookingRequestAuditLog"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingRequestAuditLog_businessId_createdAt_idx" ON "BookingRequestAuditLog"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookingRequestAuditLog" ADD CONSTRAINT "BookingRequestAuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

