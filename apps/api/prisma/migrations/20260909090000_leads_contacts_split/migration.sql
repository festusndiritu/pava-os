-- Rename: this table's fields (source, followUpAt, sales-pipeline shape)
-- always matched a Lead, not a phone-book Contact. Preserve the data.
ALTER TABLE "Contact" RENAME TO "Lead";
-- The rename doesn't touch inherited constraint/index names, and Postgres
-- requires index names to be unique per schema — so these must be renamed
-- before a new table named "Contact" can have its own same-named ones.
ALTER TABLE "Lead" RENAME CONSTRAINT "Contact_pkey" TO "Lead_pkey";
ALTER TABLE "Lead" RENAME CONSTRAINT "Contact_createdById_fkey" TO "Lead_createdById_fkey";

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_REQUIRED', 'QUOTE_SENT', 'NEGOTIATING', 'WON', 'LOST');

-- AlterTable: add the real Lead pipeline fields
ALTER TABLE "Lead"
  ADD COLUMN "company" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "expectedValue" DOUBLE PRECISION,
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "convertedCustomerId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: the real, separate operational phone book
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "notes" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "followUpAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;