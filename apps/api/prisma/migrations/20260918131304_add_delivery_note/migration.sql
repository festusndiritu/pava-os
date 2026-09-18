/*
  Warnings:

  - A unique constraint covering the columns `[deliveryNoteNumber]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'DELIVERY_NOTE';

-- AlterTable
ALTER TABLE "BusinessSetting" ADD COLUMN     "deliveryNotePrefix" TEXT NOT NULL DEFAULT 'DN',
ADD COLUMN     "nextDeliveryNoteSeq" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "deliveryNoteNumber" TEXT,
ADD COLUMN     "sourceDocumentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_deliveryNoteNumber_key" ON "Document"("deliveryNoteNumber");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
