-- Sale lines can be supplied partly (or wholly) from somewhere other than the
-- shop's own stock. stockQty is the part drawn from shop inventory; NULL means
-- "not recorded" and is read as all of it (quotes, and every line before this).
ALTER TABLE "DocumentItem" ADD COLUMN "stockQty" INTEGER;
ALTER TABLE "DocumentItem" ADD COLUMN "supplierSource" TEXT;

-- Returns restock only what came from the shop. Every earlier return restocked
-- its full quantity, so that is what it is backfilled to.
ALTER TABLE "ReturnItem" ADD COLUMN "restockedQty" INTEGER NOT NULL DEFAULT 0;
UPDATE "ReturnItem" SET "restockedQty" = "qty" WHERE "productId" IS NOT NULL;
