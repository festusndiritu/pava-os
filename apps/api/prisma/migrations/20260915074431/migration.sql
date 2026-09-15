/*
  Warnings:

  - You are about to drop the column `source` on the `Contact` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[quoteNumber]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[receiptNumber]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_REQUIRED', 'QUOTE_SENT', 'NEGOTIATING', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "source",
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "quoteNumber" TEXT,
ADD COLUMN     "receiptNumber" TEXT;

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "source" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "expectedValue" DOUBLE PRECISION,
    "notes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "convertedCustomerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'Pava Steel Hardware',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "quotePrefix" TEXT NOT NULL DEFAULT 'QT',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "receiptPrefix" TEXT NOT NULL DEFAULT 'RCT',
    "nextQuoteSeq" INTEGER NOT NULL DEFAULT 1,
    "nextInvoiceSeq" INTEGER NOT NULL DEFAULT 1,
    "nextReceiptSeq" INTEGER NOT NULL DEFAULT 1,
    "roundingIncrement" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "documentFooter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_quoteNumber_key" ON "Document"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Document_invoiceNumber_key" ON "Document"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Document_receiptNumber_key" ON "Document"("receiptNumber");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
