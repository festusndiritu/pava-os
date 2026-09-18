-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canViewCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canInvoiceWithoutStock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductFamily" ADD COLUMN     "aggregateLowStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lowStockThreshold" DOUBLE PRECISION;