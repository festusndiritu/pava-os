-- AlterTable: add displayName + structured search attributes to Product
ALTER TABLE "Product"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "shape" TEXT,
  ADD COLUMN "nominalSize" TEXT,
  ADD COLUMN "widthMm" DOUBLE PRECISION,
  ADD COLUMN "heightMm" DOUBLE PRECISION,
  ADD COLUMN "thicknessMm" DOUBLE PRECISION,
  ADD COLUMN "gauge" INTEGER,
  ADD COLUMN "material" TEXT DEFAULT 'STEEL',
  ADD COLUMN "familyId" TEXT;

-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductFamily_name_key" ON "ProductFamily"("name");

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAlias_productId_idx" ON "ProductAlias"("productId");

-- CreateIndex
CREATE INDEX "ProductAlias_term_idx" ON "ProductAlias"("term");

-- CreateIndex
CREATE INDEX "Product_familyId_idx" ON "Product"("familyId");

-- CreateIndex
CREATE INDEX "Product_shape_nominalSize_idx" ON "Product"("shape", "nominalSize");

-- CreateIndex
CREATE INDEX "Product_gauge_idx" ON "Product"("gauge");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
