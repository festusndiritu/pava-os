-- AlterTable: document numbers, assigned server-side as each stage is reached
ALTER TABLE "Document"
  ADD COLUMN "quoteNumber" TEXT,
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "receiptNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_quoteNumber_key" ON "Document"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Document_invoiceNumber_key" ON "Document"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Document_receiptNumber_key" ON "Document"("receiptNumber");

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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSetting_pkey" PRIMARY KEY ("id")
);