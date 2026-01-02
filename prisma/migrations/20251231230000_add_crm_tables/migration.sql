-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('Lead', 'Active', 'Past', 'DoNotContact');

-- CreateEnum
CREATE TYPE "CrmContactSource" AS ENUM ('manual', 'scheduler', 'reviews', 'helpdesk', 'import');

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmContact" (
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
CREATE TABLE IF NOT EXISTS "CrmTag" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmContactTag" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmContactTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmContactActivity" (
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

-- CreateIndex (with IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "CrmContact_businessId_idx" ON "CrmContact"("businessId");

CREATE INDEX IF NOT EXISTS "CrmContact_businessId_status_idx" ON "CrmContact"("businessId", "status");

CREATE INDEX IF NOT EXISTS "CrmContact_businessId_updatedAt_idx" ON "CrmContact"("businessId", "updatedAt");

CREATE INDEX IF NOT EXISTS "CrmContact_businessId_name_idx" ON "CrmContact"("businessId", "name");

CREATE INDEX IF NOT EXISTS "CrmContact_businessId_nextFollowUpAt_idx" ON "CrmContact"("businessId", "nextFollowUpAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CrmTag_businessId_name_key" ON "CrmTag"("businessId", "name");

CREATE INDEX IF NOT EXISTS "CrmTag_businessId_idx" ON "CrmTag"("businessId");

CREATE UNIQUE INDEX IF NOT EXISTS "CrmContactTag_contactId_tagId_key" ON "CrmContactTag"("contactId", "tagId");

CREATE INDEX IF NOT EXISTS "CrmContactTag_contactId_idx" ON "CrmContactTag"("contactId");

CREATE INDEX IF NOT EXISTS "CrmContactTag_tagId_idx" ON "CrmContactTag"("tagId");

CREATE INDEX IF NOT EXISTS "CrmContactActivity_contactId_idx" ON "CrmContactActivity"("contactId");

CREATE INDEX IF NOT EXISTS "CrmContactActivity_businessId_idx" ON "CrmContactActivity"("businessId");

CREATE INDEX IF NOT EXISTS "CrmContactActivity_businessId_createdAt_idx" ON "CrmContactActivity"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "CrmContactActivity_businessId_occurredAt_idx" ON "CrmContactActivity"("businessId", "occurredAt");

-- AddForeignKey (these reference tables created in this migration, so they're safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'CrmContactTag_contactId_fkey'
  ) THEN
    ALTER TABLE "CrmContactTag" 
    ADD CONSTRAINT "CrmContactTag_contactId_fkey" 
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'CrmContactTag_tagId_fkey'
  ) THEN
    ALTER TABLE "CrmContactTag" 
    ADD CONSTRAINT "CrmContactTag_tagId_fkey" 
    FOREIGN KEY ("tagId") REFERENCES "CrmTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'CrmContactActivity_contactId_fkey'
  ) THEN
    ALTER TABLE "CrmContactActivity" 
    ADD CONSTRAINT "CrmContactActivity_contactId_fkey" 
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

