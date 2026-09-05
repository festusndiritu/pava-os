-- Collapse Role to two real auth tiers (ADMIN = password, STAFF = PIN).
-- Fine-grained module access now lives on User.permissions (see Module enum
-- below) instead of being baked into the role itself.
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'STAFF');
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);
UPDATE "User" SET "role" = 'STAFF' WHERE "role" IN ('MARKETING', 'POS');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- CreateEnum
CREATE TYPE "Module" AS ENUM (
  'DASHBOARD', 'POS', 'PRODUCTS', 'INVENTORY', 'CUSTOMERS', 'QUOTES',
  'INVOICES', 'CONTACTS', 'LEADS', 'MARKETING', 'HR', 'PAYROLL',
  'EXPENSES', 'REPORTS', 'ANALYTICS', 'AUDIT', 'USERS', 'SETTINGS'
);

-- AlterTable: pinHash becomes optional (ADMIN accounts need not have one),
-- and we add everything the staff-management + session/audit work needs.
ALTER TABLE "User"
  ALTER COLUMN "pinHash" DROP NOT NULL,
  ADD COLUMN "avatar" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "permissions" "Module"[] NOT NULL DEFAULT '{}',
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey (self-relation: who created this staff account)
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
