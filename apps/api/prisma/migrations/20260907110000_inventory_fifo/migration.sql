-- AlterTable: cached stock projections on Product
ALTER TABLE "Product"
  ADD COLUMN "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "lastCost" DOUBLE PRECISION;

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'LOSS', 'CORRECTION', 'OPENING');

-- CreateTable
CREATE TABLE "InventoryReceipt" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryReceipt_receivedAt_idx" ON "InventoryReceipt"("receivedAt");

-- AddForeignKey
ALTER TABLE "InventoryReceipt" ADD CONSTRAINT "InventoryReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL,
    "remainingQuantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBatch_productId_idx" ON "InventoryBatch"("productId");

-- CreateIndex
CREATE INDEX "InventoryBatch_receiptId_idx" ON "InventoryBatch"("receiptId");

-- CreateIndex
CREATE INDEX "InventoryBatch_productId_createdAt_idx" ON "InventoryBatch"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "InventoryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_batchId_idx" ON "InventoryMovement"("batchId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;