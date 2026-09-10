-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MPESA', 'CARD', 'CREDIT');

-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN "roundingAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "DocumentItem"
  ADD COLUMN "transportAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "roundingAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "maxDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;