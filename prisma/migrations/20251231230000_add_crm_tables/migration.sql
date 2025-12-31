-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('Lead', 'Active', 'Past', 'DoNotContact');

-- CreateEnum
CREATE TYPE "CrmContactSource" AS ENUM ('manual', 'scheduler', 'reviews', 'helpdesk', 'import');

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "address" TEXT,
    "status" "CrmContactStatus" NOT NULL DEFAULT 'Lead',
    "source" "CrmContactSource" NOT NULL DEFAULT 'manual',
    "nextFollowUpAt" TIMESTAMP(3),
    "nextFollowUpNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTag" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContactTag" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmContactTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContactActivity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT,
    "summary" TEXT,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContactActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmContact_businessId_idx" ON "CrmContact"("businessId");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_status_idx" ON "CrmContact"("businessId", "status");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_updatedAt_idx" ON "CrmContact"("businessId", "updatedAt");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_name_idx" ON "CrmContact"("businessId", "name");

-- CreateIndex
CREATE INDEX "CrmContact_businessId_nextFollowUpAt_idx" ON "CrmContact"("businessId", "nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTag_businessId_name_key" ON "CrmTag"("businessId", "name");

-- CreateIndex
CREATE INDEX "CrmTag_businessId_idx" ON "CrmTag"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContactTag_contactId_tagId_key" ON "CrmContactTag"("contactId", "tagId");

-- CreateIndex
CREATE INDEX "CrmContactTag_contactId_idx" ON "CrmContactTag"("contactId");

-- CreateIndex
CREATE INDEX "CrmContactTag_tagId_idx" ON "CrmContactTag"("tagId");

-- CreateIndex
CREATE INDEX "CrmContactActivity_contactId_idx" ON "CrmContactActivity"("contactId");

-- CreateIndex
CREATE INDEX "CrmContactActivity_businessId_idx" ON "CrmContactActivity"("businessId");

-- CreateIndex
CREATE INDEX "CrmContactActivity_businessId_createdAt_idx" ON "CrmContactActivity"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmContactActivity_businessId_occurredAt_idx" ON "CrmContactActivity"("businessId", "occurredAt");

-- AddForeignKey
ALTER TABLE "CrmContactTag" ADD CONSTRAINT "CrmContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactTag" ADD CONSTRAINT "CrmContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CrmTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactActivity" ADD CONSTRAINT "CrmContactActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

