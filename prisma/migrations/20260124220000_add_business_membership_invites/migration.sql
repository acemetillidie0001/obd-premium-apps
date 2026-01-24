-- Add Business + BusinessUser + TeamInvite + TeamRole
-- IMPORTANT: Business.id is the existing tenant key (V3: businessId == userId)

-- CreateEnum (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TeamRole'
  ) THEN
    CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');
  END IF;
END $$;

-- CreateTable: Business
CREATE TABLE IF NOT EXISTS "Business" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BusinessUser (membership join)
CREATE TABLE IF NOT EXISTS "BusinessUser" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TeamRole" NOT NULL DEFAULT 'OWNER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastActiveAt" TIMESTAMP(3),

  CONSTRAINT "BusinessUser_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: BusinessUser
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessUser_businessId_userId_key" ON "BusinessUser"("businessId", "userId");

-- CreateIndex: BusinessUser
CREATE INDEX IF NOT EXISTS "BusinessUser_businessId_idx" ON "BusinessUser"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessUser_userId_idx" ON "BusinessUser"("userId");

-- CreateTable: TeamInvite
CREATE TABLE IF NOT EXISTS "TeamInvite" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TeamRole" NOT NULL DEFAULT 'STAFF',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: TeamInvite
CREATE INDEX IF NOT EXISTS "TeamInvite_businessId_idx" ON "TeamInvite"("businessId");
CREATE INDEX IF NOT EXISTS "TeamInvite_email_idx" ON "TeamInvite"("email");

-- Foreign keys (conditionally add for idempotency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='Business'
  ) THEN
    -- BusinessUser.businessId -> Business.id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'BusinessUser_businessId_fkey'
    ) THEN
      ALTER TABLE "BusinessUser"
      ADD CONSTRAINT "BusinessUser_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- TeamInvite.businessId -> Business.id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'TeamInvite_businessId_fkey'
    ) THEN
      ALTER TABLE "TeamInvite"
      ADD CONSTRAINT "TeamInvite_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='User'
  ) THEN
    -- BusinessUser.userId -> User.id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'BusinessUser_userId_fkey'
    ) THEN
      ALTER TABLE "BusinessUser"
      ADD CONSTRAINT "BusinessUser_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

