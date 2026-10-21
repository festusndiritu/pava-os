-- Mixed payments, change left as customer credit, and admin-approved edits.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MIXED';
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'CHANGE_DEPOSIT';

ALTER TABLE "Document" ADD COLUMN "changeGiven" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "changeToCredit" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "EditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "DocumentPayment" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentPayment_documentId_idx" ON "DocumentPayment"("documentId");
ALTER TABLE "DocumentPayment" ADD CONSTRAINT "DocumentPayment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing single-method sales get one payment row so reports can rely on it.
INSERT INTO "DocumentPayment" ("id", "documentId", "method", "amount", "createdAt")
SELECT 'bf_' || "id", "id", "paymentMethod", "total", COALESCE("paidAt", "createdAt")
FROM "Document" WHERE "status" = 'PAID' AND "paymentMethod" IS NOT NULL;

CREATE TABLE "DocumentEditRequest" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "EditRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "previousTotal" INTEGER NOT NULL,
  "proposedTotal" INTEGER NOT NULL,
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "DocumentEditRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentEditRequest_documentId_idx" ON "DocumentEditRequest"("documentId");
CREATE INDEX "DocumentEditRequest_status_idx" ON "DocumentEditRequest"("status");
ALTER TABLE "DocumentEditRequest" ADD CONSTRAINT "DocumentEditRequest_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentEditRequest" ADD CONSTRAINT "DocumentEditRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentEditRequest" ADD CONSTRAINT "DocumentEditRequest_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
