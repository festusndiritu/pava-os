-- AlterTable: add nullable first so we can backfill existing rows
ALTER TABLE "DocumentItem" ADD COLUMN "basePrice" DOUBLE PRECISION;

-- Backfill: for pre-existing rows we don't know the original pre-discount
-- price, so the best available approximation is the final unitPrice itself.
UPDATE "DocumentItem" SET "basePrice" = "unitPrice" WHERE "basePrice" IS NULL;

-- Now enforce NOT NULL with the same default new rows will use going forward.
ALTER TABLE "DocumentItem" ALTER COLUMN "basePrice" SET NOT NULL;
ALTER TABLE "DocumentItem" ALTER COLUMN "basePrice" SET DEFAULT 0;